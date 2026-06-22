import { apiRequest, findPostBySerial, findPostState, createNotification, logger } from './api-client.js';

export interface WashMessage {
  washSerial?: string;
  postSerial?: string;
  messageType: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

export async function processMessage(msg: WashMessage): Promise<void> {
  const receivedAt = msg.timestamp || new Date().toISOString();

  await apiRequest('POST', '/api/crm/telemetry', {
    washSerial: msg.washSerial,
    postSerial: msg.postSerial,
    messageType: msg.messageType,
    payload: msg.payload,
    receivedAt,
  });

  const postSerial = msg.postSerial || String(msg.payload.postSerial || '');
  if (!postSerial) {
    logger.warn({ msg }, 'Message without post serial');
    return;
  }

  const post = await findPostBySerial(postSerial);
  if (!post) {
    logger.warn({ postSerial }, 'Post not found for serial');
    return;
  }

  switch (msg.messageType) {
    case 'mode':
    case 'state':
      await handlePostState(post.id, post.washId, msg.payload, receivedAt);
      break;
    case 'card':
      await handleCard(post.washId, post.id, msg.payload);
      break;
    case 'statistics':
      await handleUsageStats(post.washId, post.id, msg.payload, receivedAt);
      break;
    case 'finance':
      await handleFinanceStats(post.washId, post.id, msg.payload, receivedAt);
      break;
    case 'equipment':
      await handleEquipment(post.id, post.washId, msg.payload, receivedAt);
      break;
    case 'event':
      await handleEvent(post.id, post.washId, msg.payload);
      break;
    case 'settings':
      await apiRequest('PUT', `/api/crm/posts/${post.id}`, {
        settings: msg.payload,
      });
      break;
    default:
      logger.info({ messageType: msg.messageType }, 'Unknown message type, stored in telemetry');
  }
}

async function handlePostState(
  postId: string,
  washId: string,
  payload: Record<string, unknown>,
  receivedAt: string
): Promise<void> {
  const stateData = {
    postId,
    washId,
    mode: String(payload.mode || ''),
    modeName: String(payload.modeName || payload.mode_name || ''),
    modeNumber: Number(payload.modeNumber ?? payload.mode_number ?? 0),
    freePause: Number(payload.freePause ?? payload.free_pause ?? 0),
    paidPause: Number(payload.paidPause ?? payload.paid_pause ?? 0),
    modeTime: Number(payload.modeTime ?? payload.mode_time ?? 0),
    equipmentState: payload.equipmentState || payload.equipment_state || {},
    lastMessageAt: receivedAt,
    connected: true,
  };

  const existing = await findPostState(postId);
  if (existing) {
    await apiRequest('PATCH', `/api/crm/post-states/${existing.id}`, stateData);
  } else {
    await apiRequest('POST', '/api/crm/post-states', stateData);
  }

  await apiRequest('PATCH', `/api/crm/posts/${postId}`, { status: 'online' });
}

async function handleCard(
  washId: string,
  postId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cardNumber = String(payload.cardNumber || payload.card_number || '');
  if (!cardNumber) return;

  const cards = await apiRequest<Array<{ id: string; cardNumber: string }>>('GET', '/api/crm/cards?limit=500');
  const existing = cards.find((c) => c.cardNumber === cardNumber);

  const cardData = {
    cardNumber,
    cardType: String(payload.cardType || payload.card_type || 'regular'),
    balance: Number(payload.balance ?? 0),
    discount: Number(payload.discount ?? 0),
    status: String(payload.status || 'active'),
    washId,
    postId,
  };

  if (existing) {
    await apiRequest('PUT', `/api/crm/cards/${existing.id}`, cardData);
  } else {
    await apiRequest('POST', '/api/crm/cards', cardData);
  }
}

async function handleUsageStats(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  await apiRequest('POST', '/api/crm/usage-stats', {
    washId,
    postId,
    period: String(payload.period || 'before_collection'),
    category: String(payload.category || 'regular'),
    launchCount: Number(payload.launchCount ?? payload.launch_count ?? 0),
    usageTime: Number(payload.usageTime ?? payload.usage_time ?? 0),
    avgWashTime: Number(payload.avgWashTime ?? payload.avg_wash_time ?? 0),
    clientCount: Number(payload.clientCount ?? payload.client_count ?? 0),
    recordedAt,
  });
}

async function handleFinanceStats(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  await apiRequest('POST', '/api/crm/finance-stats', {
    washId,
    postId,
    period: String(payload.period || 'before_collection'),
    cash: Number(payload.cash ?? 0),
    cashless: Number(payload.cashless ?? 0),
    discountOps: Number(payload.discountOps ?? payload.discount_ops ?? 0),
    totalRevenue: Number(payload.totalRevenue ?? payload.total_revenue ?? 0),
    avgCheck: Number(payload.avgCheck ?? payload.avg_check ?? 0),
    recordedAt,
  });
}

async function handleEquipment(
  postId: string,
  washId: string,
  payload: Record<string, unknown>,
  receivedAt: string
): Promise<void> {
  const hasError = Boolean(payload.error || payload.hasError);
  if (hasError) {
    await createNotification({
      type: 'equipment_error',
      severity: 'error',
      washId,
      postId,
      message: String(payload.error || payload.message || 'Ошибка оборудования'),
    });
  }

  const existing = await findPostState(postId);
  const patch = {
    postId,
    washId,
    equipmentState: payload,
    lastMessageAt: receivedAt,
    connected: !hasError,
  };

  if (existing) {
    await apiRequest('PATCH', `/api/crm/post-states/${existing.id}`, patch);
  } else {
    await apiRequest('POST', '/api/crm/post-states', patch);
  }

  if (hasError) {
    await apiRequest('PATCH', `/api/crm/posts/${postId}`, { status: 'error' });
  }
}

async function handleEvent(
  postId: string,
  washId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const eventType = String(payload.eventType || payload.type || 'connection_lost');
  const severity = eventType === 'connection_lost' ? 'warning' : 'error';

  if (eventType === 'connection_lost') {
    await apiRequest('PATCH', `/api/crm/posts/${postId}`, { status: 'offline' });
    const existing = await findPostState(postId);
    if (existing) {
      await apiRequest('PATCH', `/api/crm/post-states/${existing.id}`, {
        connected: false,
        lastMessageAt: new Date().toISOString(),
      });
    }
  }

  await createNotification({
    type: eventType,
    severity,
    washId,
    postId,
    message: String(payload.message || `Событие: ${eventType}`),
  });
}
