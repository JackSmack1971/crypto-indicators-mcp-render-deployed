'use strict';
const { createRemoteJWKSet, jwtVerify } = require('jose');
const RESOURCE = process.env.MCP_RESOURCE_URL || 'https://crypto-indicators-mcp-render.onrender.com/mcp';
const ISSUER = process.env.OAUTH_ISSUER_URL;
const AUDIENCE = process.env.OAUTH_AUDIENCE;
const SCOPE = process.env.OAUTH_SCOPE || 'indicators:read';
function config() {
  if (!ISSUER || !AUDIENCE) return null;
  const url = new URL(ISSUER);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('OAUTH_ISSUER_URL must be an HTTPS issuer URL');
  const resource = new URL(RESOURCE);
  if (resource.protocol !== 'https:') throw new Error('MCP_RESOURCE_URL must be HTTPS');
  return { issuer: ISSUER, audience: AUDIENCE, resource: RESOURCE, scope: SCOPE, jwks: createRemoteJWKSet(new URL('.well-known/jwks.json', ISSUER.endsWith('/') ? ISSUER : ISSUER + '/')) };
}
const oauth = config();
function metadata() {
  return { resource: oauth.resource, authorization_servers: [oauth.issuer], scopes_supported: [oauth.scope] };
}
function challenge() {
  return 'Bearer resource_metadata="' + new URL('/.well-known/oauth-protected-resource', oauth.resource).href + '", scope="' + oauth.scope + '"';
}
async function verify(header) {
  if (!oauth) return null;
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header || '');
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], oauth.jwks, { issuer: oauth.issuer, audience: oauth.audience, algorithms: ['RS256'] });
    if (!String(payload.scope || '').split(/\s+/).includes(oauth.scope) && !Array.isArray(payload.permissions)) return null;
    if (Array.isArray(payload.permissions) && !payload.permissions.includes(oauth.scope) && !String(payload.scope || '').split(/\s+/).includes(oauth.scope)) return null;
    return payload;
  } catch { return null; }
}
module.exports = { oauth, metadata, challenge, verify };
