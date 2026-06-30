import { endpointRepository, logRepository } from '../repositories';
import { getVersionedApiPath } from '../utils';
import { dynamicEngine } from './endpoint.service';
import { openApiService } from './openapi.service';
import { resolveLogUserId } from '../utils/auditLog';
import { JwtPayload } from '../types';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

function toolName(method: string, path: string): string {
  return buildMcpToolName(method, path);
}

export function buildMcpToolName(method: string, path: string): string {
  return `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function toTool(ep: { method: string; path: string; name: string; description?: string; apiVersion?: string }): McpTool {
  const publicPath = getVersionedApiPath(ep.path, ep.apiVersion);
  return {
    name: toolName(ep.method, ep.path),
    description: ep.description || `${ep.method} ${publicPath} — ${ep.name}`,
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'object', description: 'Request JSON body (POST/PUT/PATCH)' },
        query: { type: 'object', description: 'Query parameters' },
        params: { type: 'object', description: 'Path parameters, e.g. { id: "..." }' },
      },
    },
  };
}

export class McpService {
  async listAllTools(): Promise<McpTool[]> {
    const endpoints = await endpointRepository.findAll({ isSystem: false, enabled: true });
    return endpoints.map(toTool);
  }

  async listToolsForUser(user: JwtPayload): Promise<McpTool[]> {
    const endpoints = await endpointRepository.findAll({ isSystem: false, enabled: true });
    return endpoints
      .filter((ep) => dynamicEngine.canAccessEndpoint(ep, user))
      .map(toTool);
  }

  async callTool(name: string, args: Record<string, unknown> = {}, user: JwtPayload): Promise<unknown> {
    const endpoints = await endpointRepository.findAll({ isSystem: false, enabled: true });
    const endpoint = endpoints.find((ep) => toolName(ep.method, ep.path) === name);
    if (!endpoint) throw new Error(`Unknown tool: ${name}`);
    if (!dynamicEngine.canAccessEndpoint(endpoint, user)) {
      throw new Error('Forbidden: insufficient permissions for this tool');
    }

    let path = endpoint.path;
    const params = (args.params || {}) as Record<string, string>;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, encodeURIComponent(value));
    }

    const result = await dynamicEngine.handleRequest(
      path,
      endpoint.method,
      args.body || {},
      (args.query || {}) as Record<string, string>,
      user,
      { ip: '127.0.0.1', userAgent: 'mcp-server', skipAuditLog: true }
    );

    await logRepository.create({
      action: 'mcp_call',
      source: 'mcp',
      userId: resolveLogUserId(user),
      endpointId: endpoint._id,
      message: `MCP tool ${name} - ${result.statusCode}`,
      statusCode: result.statusCode,
      userAgent: 'mcp-server',
      details: { toolName: name, login: user.login },
    });

    if (result.statusCode >= 400) {
      throw new Error(typeof result.body === 'object' && result.body && 'error' in (result.body as object)
        ? String((result.body as { error: string }).error)
        : `Request failed with status ${result.statusCode}`);
    }

    return result.body;
  }

  async handleJsonRpc(request: JsonRpcRequest, user: JwtPayload): Promise<Record<string, unknown>> {
    const id = request.id ?? null;

    try {
      switch (request.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'dynamic-api-platform', version: '1.4.0' },
            },
          };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: await this.listToolsForUser(user) },
          };

        case 'tools/call': {
          const params = request.params || {};
          const name = String(params.name || '');
          const args = (params.arguments || {}) as Record<string, unknown>;
          const content = await this.callTool(name, args, user);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(content, null, 2) }],
            },
          };
        }

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              resources: [
                {
                  uri: 'openapi://spec',
                  name: 'OpenAPI Specification',
                  mimeType: 'application/json',
                },
              ],
            },
          };

        case 'resources/read': {
          const uri = String(request.params?.uri || '');
          if (uri === 'openapi://spec') {
            const spec = await openApiService.generateSpec('/api');
            return {
              jsonrpc: '2.0',
              id,
              result: {
                contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(spec, null, 2) }],
              },
            };
          }
          throw new Error(`Unknown resource: ${uri}`);
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'MCP error',
        },
      };
    }
  }
}

export const mcpService = new McpService();
