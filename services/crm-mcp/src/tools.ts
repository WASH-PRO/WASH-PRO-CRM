import { z } from 'zod';
import { CrmApiClient, CrmApiError } from './client.js';

function dump(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function handleError(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError?: true } {
  if (error instanceof CrmApiError) {
    return {
      content: [{ type: 'text', text: dump({ error: error.message, status: error.status, body: error.body }) }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: dump({ error: error instanceof Error ? error.message : String(error) }) }],
    isError: true,
  };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: dump(data) }] };
}

const pageQuery = {
  page: z.number().int().min(1).optional().describe('Page number'),
  limit: z.number().int().min(1).max(500).optional().describe('Items per page'),
  populate: z.string().optional().describe('Populate references, e.g. washId'),
};

export function registerTools(server: {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }>
  ) => void;
}, client: CrmApiClient) {
  server.tool('crm_health', 'Check Dynamic API health.', {}, async () => {
    try {
      return ok(await client.health());
    } catch (error) {
      return handleError(error);
    }
  });

  server.tool(
    'crm_login',
    'Authenticate with CRM login/password and store JWT for subsequent calls.',
    {
      login: z.string().describe('CRM user login'),
      password: z.string().describe('CRM user password'),
    },
    async ({ login, password }) => {
      try {
        return ok(await client.login(String(login), String(password)));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool('crm_whoami', 'Return current CRM user profile and permissions.', {}, async () => {
    try {
      return ok(await client.whoami());
    } catch (error) {
      return handleError(error);
    }
  });

  server.tool('crm_dynamic_list_tools', 'List all Dynamic API MCP tools available to the current user.', {}, async () => {
    try {
      return ok(await client.mcpListTools());
    } catch (error) {
      return handleError(error);
    }
  });

  server.tool(
    'crm_dynamic_call',
    'Call any auto-generated Dynamic API MCP tool by name (e.g. get_api_crm_washes).',
    {
      name: z.string().describe('Tool name from crm_dynamic_list_tools'),
      params: z.record(z.unknown()).optional().describe('Path params, e.g. { id: "..." }'),
      query: z.record(z.unknown()).optional().describe('Query params, e.g. { page: "1", limit: "20" }'),
      body: z.record(z.unknown()).optional().describe('JSON request body'),
    },
    async ({ name, params, query, body }) => {
      try {
        return ok(
          await client.mcpCallTool(String(name), {
            params: params || {},
            query: query || {},
            body: body || {},
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_washes',
    'List car washes.',
    pageQuery,
    async ({ page, limit, populate }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/washes', {
            page: page as number | undefined,
            limit: limit as number | undefined,
            populate: populate as string | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_wash',
    'Get a car wash by ID.',
    { id: z.string().describe('Wash ID') },
    async ({ id }) => {
      try {
        return ok(await client.crmGet(`/api/crm/washes/${id}`));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_create_wash',
    'Create a car wash.',
    {
      name: z.string(),
      address: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      try {
        return ok(await client.crmCreate('/api/crm/washes', args));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_wash_overview',
    'Get wash with its posts and latest post states.',
    { washId: z.string().describe('Wash ID') },
    async ({ washId }) => {
      try {
        const wash = await client.crmGet<Record<string, unknown>>(`/api/crm/washes/${washId}`);
        const posts = await client.crmPage<Record<string, unknown>>('/api/crm/posts', {
          washId: String(washId),
          limit: 200,
        });
        const states = await client.crmPage<Record<string, unknown>>('/api/crm/post-states', {
          limit: 500,
          populate: 'postId',
        });
        const postIds = new Set(posts.map((p) => String(p._id || p.id)));
        const statesByPost = states.filter((s) => {
          const post = s.postId as Record<string, unknown> | string | undefined;
          const postId = typeof post === 'object' && post ? String(post._id || post.id) : String(post || '');
          return postIds.has(postId);
        });
        return ok({ wash, posts, postStates: statesByPost });
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_posts',
    'List equipment posts. Optionally filter by washId.',
    {
      ...pageQuery,
      washId: z.string().optional().describe('Filter by wash ID'),
    },
    async ({ page, limit, populate, washId }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/posts', {
            page: page as number | undefined,
            limit: limit as number | undefined,
            populate: populate as string | undefined,
            washId: washId as string | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_post',
    'Get a post by ID.',
    { id: z.string().describe('Post ID') },
    async ({ id }) => {
      try {
        return ok(await client.crmGet(`/api/crm/posts/${id}`));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_create_post',
    'Create an equipment post linked to a wash.',
    {
      washId: z.string(),
      name: z.string(),
      serial: z.string().optional(),
      mqttPrefix: z.string().optional(),
    },
    async (args) => {
      try {
        return ok(await client.crmCreate('/api/crm/posts', args));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_post_states',
    'List live SCADA post states.',
    pageQuery,
    async ({ page, limit, populate }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/post-states', {
            page: page as number | undefined,
            limit: limit as number | undefined,
            populate: populate as string | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_update_post_state',
    'Update post state fields (mode, balance, equipment flags, etc.).',
    {
      id: z.string().describe('Post state ID'),
      patch: z.record(z.unknown()).describe('Fields to update'),
    },
    async ({ id, patch }) => {
      try {
        return ok(await client.crmUpdate(`/api/crm/post-states/${id}`, patch, 'PATCH'));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_cards',
    'List client cards.',
    {
      ...pageQuery,
      washId: z.string().optional(),
      postId: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ page, limit, populate, washId, postId, status }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/cards', {
            page: page as number | undefined,
            limit: limit as number | undefined,
            populate: populate as string | undefined,
            washId: washId as string | undefined,
            postId: postId as string | undefined,
            status: status as string | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_notifications',
    'List CRM notifications/alerts.',
    {
      ...pageQuery,
      unreadOnly: z.boolean().optional().describe('Filter unread notifications'),
    },
    async ({ page, limit, unreadOnly }) => {
      try {
        const items = await client.crmPage<Record<string, unknown>>('/api/crm/notifications', {
          page: page as number | undefined,
          limit: limit as number | undefined,
        });
        const filtered =
          unreadOnly === true ? items.filter((item) => item.read !== true && item.isRead !== true) : items;
        return ok(filtered);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_mark_notification_read',
    'Mark a notification as read.',
    { id: z.string().describe('Notification ID') },
    async ({ id }) => {
      try {
        return ok(await client.crmUpdate(`/api/crm/notifications/${id}`, { read: true, isRead: true }, 'PATCH'));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_list_info_messages',
    'List informational messages for public Telegram bots (news, promotions).',
    pageQuery,
    async ({ page, limit, populate }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/info-messages', {
            page: page as number | undefined,
            limit: limit as number | undefined,
            populate: populate as string | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_create_info_message',
    'Create an informational message.',
    {
      title: z.string(),
      body: z.string().optional(),
      imageUrl: z.string().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      washId: z.string().optional(),
      publishedAt: z.string().optional(),
    },
    async (args) => {
      try {
        return ok(await client.crmCreate('/api/crm/info-messages', args));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_settings',
    'Get CRM settings entries. Optionally filter by key prefix.',
    { key: z.string().optional().describe('Exact settings key, e.g. telegram') },
    async ({ key }) => {
      try {
        const items = await client.crmPage<Record<string, unknown>>('/api/crm/settings', { limit: 200 });
        if (key) {
          return ok(items.filter((item) => String(item.key || '') === String(key)));
        }
        return ok(items);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_update_setting',
    'Create or update a CRM settings key/value JSON document.',
    {
      key: z.string(),
      value: z.record(z.unknown()).describe('Settings JSON value'),
    },
    async ({ key, value }) => {
      try {
        const items = await client.crmPage<Record<string, unknown>>('/api/crm/settings', { limit: 200 });
        const existing = items.find((item) => String(item.key || '') === String(key));
        if (existing?._id || existing?.id) {
          const id = String(existing._id || existing.id);
          return ok(await client.crmUpdate(`/api/crm/settings/${id}`, { key, value }, 'PUT'));
        }
        return ok(await client.crmCreate('/api/crm/settings', { key, value }));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_usage_statistics',
    'Get usage statistics records.',
    pageQuery,
    async ({ page, limit }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/usage-stats', {
            page: page as number | undefined,
            limit: limit as number | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_get_finance_statistics',
    'Get finance/revenue statistics records.',
    pageQuery,
    async ({ page, limit }) => {
      try {
        return ok(
          await client.crmPage('/api/crm/finance-stats', {
            page: page as number | undefined,
            limit: limit as number | undefined,
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool('crm_list_telegram_bots', 'List Telegram bots managed by pyorch-bridge.', {}, async () => {
    try {
      return ok(await client.dashboardRequest('/api/telegram-bots/bots'));
    } catch (error) {
      return handleError(error);
    }
  });

  server.tool(
    'crm_create_telegram_bot',
    'Create a Telegram bot (management, service, or informational).',
    {
      name: z.string(),
      token: z.string(),
      botType: z.enum(['management', 'service', 'informational']).optional(),
      enabled: z.boolean().optional(),
      commands: z.array(z.string()).optional(),
      adminIds: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        return ok(await client.dashboardRequest('/api/telegram-bots/bots', { method: 'POST', body: args }));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_start_telegram_bot',
    'Start a Telegram bot by ID.',
    { id: z.string() },
    async ({ id }) => {
      try {
        return ok(await client.dashboardRequest(`/api/telegram-bots/bots/${id}/start`, { method: 'POST' }));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_stop_telegram_bot',
    'Stop a Telegram bot by ID.',
    { id: z.string() },
    async ({ id }) => {
      try {
        return ok(await client.dashboardRequest(`/api/telegram-bots/bots/${id}/stop`, { method: 'POST' }));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_send_post_command',
    'Send an MQTT command to a post by serial number.',
    {
      serial: z.string(),
      command: z.string().describe('Device command key'),
      amount: z.number().optional(),
      mqttPrefix: z.string().optional(),
    },
    async ({ serial, command, amount, mqttPrefix }) => {
      try {
        return ok(
          await client.dashboardRequest(`/api/crm/post-device/posts/${encodeURIComponent(String(serial))}/command`, {
            method: 'POST',
            body: { command, amount, mqttPrefix },
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    'crm_set_post_prices',
    'Push prices to a post device by serial number.',
    {
      serial: z.string(),
      prices: z.record(z.number()),
      mqttPrefix: z.string().optional(),
      sendToDevice: z.boolean().optional(),
      persist: z.boolean().optional(),
    },
    async ({ serial, prices, mqttPrefix, sendToDevice, persist }) => {
      try {
        return ok(
          await client.dashboardRequest(`/api/crm/post-device/posts/${encodeURIComponent(String(serial))}/prices`, {
            method: 'POST',
            body: { prices, mqttPrefix, sendToDevice, persist },
          })
        );
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool('crm_sync_mqtt_users', 'Regenerate Mosquitto passwd/ACL from CRM posts.', {}, async () => {
    try {
      return ok(await client.dashboardRequest('/api/crm/post-device/mqtt/sync-users', { method: 'POST' }));
    } catch (error) {
      return handleError(error);
    }
  });
}
