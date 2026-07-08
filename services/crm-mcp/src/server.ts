import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { CrmApiClient } from './client.js';
import { registerTools } from './tools.js';

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const client = new CrmApiClient(config);

  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerTools(
    {
      tool: (name, description, schema, handler) => {
        server.tool(name, description, schema, handler);
      },
    },
    client
  );

  try {
    await client.ensureAuth();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[wash-crm-mcp] Auth on startup skipped: ${message}\n`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[wash-crm-mcp] MCP server ready (stdio)\n');
}
