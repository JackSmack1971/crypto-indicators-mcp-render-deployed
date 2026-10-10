'use strict';
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createServer } = require('./server-factory');
(async () => {
  const server = createServer();
  await server.connect(new StdioServerTransport());
})().catch(error => { console.error(error); process.exitCode = 1; });
