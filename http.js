'use strict';
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createServer } = require('./server-factory');
const oauthAuth = require('./oauth');
const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const token = process.env.MCP_BEARER_TOKEN;
if (!oauthAuth.oauth && (!token || token.length < 24)) throw new Error('Configure OAuth or MCP_BEARER_TOKEN');
const MAX_BODY_BYTES = 512 * 1024;
const MAX_CONCURRENT = 10;
let inFlight = 0;
function legacyAuthorized(header) {
  if (!token) return false;
  const expected = Buffer.from('Bearer ' + token);
  const supplied = Buffer.from(header || '');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
const app = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', oauth_configured: Boolean(oauthAuth.oauth) }));
  }
  if (oauthAuth.oauth && req.method === 'GET' && (req.url === '/.well-known/oauth-protected-resource' || req.url === '/.well-known/oauth-protected-resource/mcp')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' });
    return res.end(JSON.stringify(oauthAuth.metadata()));
  }
  if (req.url !== '/mcp') { res.writeHead(404); return res.end(); }
  const allowed = oauthAuth.oauth ? Boolean(await oauthAuth.verify(req.headers.authorization)) : legacyAuthorized(req.headers.authorization);
  if (!allowed) {
    res.writeHead(401, { 'www-authenticate': oauthAuth.oauth ? oauthAuth.challenge() : 'Bearer' });
    return res.end();
  }
  if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); return res.end(); }
  if (inFlight >= MAX_CONCURRENT) { res.writeHead(503, { 'retry-after': '2' }); return res.end(); }
  if (String(req.headers['content-type'] || '').split(';')[0].toLowerCase() !== 'application/json') { res.writeHead(415); return res.end(); }
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) { res.writeHead(413); return res.end(); }
  inFlight++;
  let server, transport;
  try {
    let size = 0;
    const parts = [];
    for await (const part of req) {
      size += part.length;
      if (size > MAX_BODY_BYTES) { res.writeHead(413); res.end(); return; }
      parts.push(part);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); }
    catch { res.writeHead(400); res.end(); return; }
    server = createServer();
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) res.writeHead(500);
    if (!res.writableEnded) res.end();
  } finally {
    if (transport) await transport.close().catch(() => {});
    if (server) await server.close().catch(() => {});
    inFlight--;
  }
});
app.requestTimeout = 30000;
app.listen(port, '0.0.0.0', () => console.error('MCP HTTP listening on ' + port));
