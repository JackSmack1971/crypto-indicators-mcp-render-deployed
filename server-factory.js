'use strict';
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
function createServer() {
  const server = new McpServer({ name: 'crypto-indicators-mcp', version: '1.0.1' });
  for (const path of [
    './indicators/trendIndicators', './indicators/momentumIndicators',
    './indicators/volatilityIndicators', './indicators/volumeIndicators',
    './strategies/trendStrategies', './strategies/momentumStrategies',
    './strategies/volatilityStrategies', './strategies/volumeStrategies'
  ]) require(path)(server);
  return server;
}
module.exports = { createServer };
