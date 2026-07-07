import { apiRequest, createNotification, findPostBySerial, findPostState, setCachedPostState, logger } from './api-client.js';
import { resolveTrustedPostSerial } from './mqtt-post-bindings.js';

export interface WashMessage {
  washSerial?: string;
  postSerial?: string;
  messageType: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

export async function processMessage(msg: WashMessage, mqttTopic?: string): Promise<void> {
  const receivedAt = msg.timestamp || new Date().toISOString();

  const postSerial = mqttTopic
    ? resolveTrustedPostSerial(mqttTopic, msg)
    : (msg.postSerial || String(msg.payload.postSerial || ''));

  if (!postSerial) {
    logger.warn({ msg, mqttTopic }, 'Message without post serial');
    return;
  }

  const post = await findPostBySerial(postSerial);
  if (!post) {
    logger.warn({ postSerial, mqttTopic }, 'Post not found for serial — message ignored');
    return;
  }

  try {
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
        logger.info({ messageType: msg.messageType }, 'Unknown message type, skipped CRM write');
    }
  } catch (err) {
    logger.error({ err, postSerial, messageType: msg.messageType }, 'CRM handler failed');
  }
}

async function handlePostState(
  postId: string,
  washId: string,
  payload: Record<string, unknown>,
  receivedAt: string
): Promise<void> {
  const equipmentState: Record<string, unknown> = {
    ...(typeof payload.equipmentState === 'object' && payload.equipmentState !== null
      ? (payload.equipmentState as Record<string, unknown>)
      : typeof payload.equipment_state === 'object' && payload.equipment_state !== null
        ? (payload.equipment_state as Record<string, unknown>)
        : {}),
  };
  if (payload.card != null) equipmentState.card = payload.card;
  if (payload.type != null) equipmentState.cardType = payload.type;
  if (payload.inactiv != null) equipmentState.inactivTimer = payload.inactiv;
  if (payload.light != null) equipmentState.lightTimer = payload.light;

  const stateData = {
    postId,
    washId,
    mode: String(payload.mode || ''),
    modeName: String(payload.modeName || payload.mode_name || ''),
    modeNumber: Number(payload.modeNumber ?? payload.mode_number ?? payload.number ?? 0),
    freePause: Number(payload.freePause ?? payload.free_pause ?? payload.pause ?? 0),
    paidPause: Number(payload.paidPause ?? payload.paid_pause ?? 0),
    balance: Number(payload.balance ?? payload.currentBalance ?? payload.current_balance ?? 0),
    discount: Number(payload.discount ?? 0),
    modeTime: Number(payload.modeTime ?? payload.mode_time ?? 0),
    equipmentState,
    lastMessageAt: receivedAt,
    connected: true,
  };

  const existing = await findPostState(postId);
  if (existing) {
    await apiRequest('PATCH', `/api/crm/post-states/${existing.id}`, stateData);
    setCachedPostState(postId, existing.id, {
      balance: stateData.balance,
      discount: stateData.discount,
    });
  } else {
    const created = await apiRequest<{ id: string }>('POST', '/api/crm/post-states', stateData);
    if (created?.id) {
      setCachedPostState(postId, created.id, {
        balance: stateData.balance,
        discount: stateData.discount,
      });
    }
  }

  await syncActiveCardFromProcess(postId, washId, payload, equipmentState, {
    balance: stateData.balance,
    discount: stateData.discount,
  });
}

const DEVICE_CARD_TYPES: Record<number, string> = {
  0: 'regular',
  1: 'service',
  2: 'unlimited',
};

/** Текущее применение карты на посту (обновляется из state/process). */
const activeCardApplicationByPost = new Map<
  string,
  { id: string; cardNumber: string; cardType: string; discountType?: string }
>();

/** В state/process поле card — номер карты (>1), а не флаг 0/1. */
function resolveActiveCardNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return null;
  return String(Math.trunc(n));
}

async function syncActiveCardFromProcess(
  postId: string,
  washId: string,
  payload: Record<string, unknown>,
  equipmentState: Record<string, unknown>,
  state: { balance: number; discount: number }
): Promise<void> {
  const cardNumber =
    resolveActiveCardNumber(payload.card) ??
    resolveActiveCardNumber(equipmentState.card);

  if (!cardNumber) {
    activeCardApplicationByPost.delete(postId);
    return;
  }

  let session = activeCardApplicationByPost.get(postId);

  if (!session || session.cardNumber !== cardNumber) {
    const cards = await apiRequest<Array<{
      id: string;
      cardNumber: string;
      postId: unknown;
      cardType: string;
      discountType?: string;
      createdAt?: string;
    }>>('GET', '/api/crm/cards?limit=500');
    const latest = cards
      .filter((c) => refId(c.postId) === postId && c.cardNumber === cardNumber)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0];
    if (!latest) return;
    session = {
      id: latest.id,
      cardNumber,
      cardType: latest.cardType,
      discountType: latest.discountType,
    };
    activeCardApplicationByPost.set(postId, session);
  }

  const deviceType = Number(equipmentState.cardType ?? payload.type ?? -1);
  const cardData = {
    cardNumber,
    cardType: session.cardType || DEVICE_CARD_TYPES[deviceType] || 'regular',
    balance: state.balance,
    discount: state.discount,
    discountType: session.discountType,
    status: 'success',
    washId,
    postId,
  };

  await apiRequest('PUT', `/api/crm/cards/${session.id}`, cardData);
}

async function handleCard(
  washId: string,
  postId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cardNumber = String(payload.cardNumber || payload.card_number || '');
  const cardType = String(payload.cardType || payload.card_type || 'regular');

  if (cardType === 'collection') {
    const appliedAt = new Date().toISOString();
    if (cardNumber) {
      await apiRequest('POST', '/api/crm/cards', {
        cardNumber,
        cardType: 'collection',
        balance: 0,
        discount: 0,
        status: String(payload.status || 'success'),
        washId,
        postId,
        createdAt: appliedAt,
      });
    }
    await createNotification({
      type: 'mqtt_collection',
      severity: 'info',
      washId,
      postId,
      message: cardNumber
        ? `Инкассация на посте (карта ${cardNumber})`
        : 'Инкассация на посте',
    });
    return;
  }

  if (!cardNumber) return;

  const postState = await findPostState(postId);
  const appliedAt = new Date().toISOString();

  const cardData = {
    cardNumber,
    cardType,
    balance: Number(payload.balance ?? postState?.balance ?? 0),
    discount: Number(payload.discount ?? postState?.discount ?? 0),
    discountType: payload.discountType != null ? String(payload.discountType) : undefined,
    status: String(payload.status || 'success'),
    washId,
    postId,
    createdAt: appliedAt,
  };

  const created = await apiRequest<{ id: string }>('POST', '/api/crm/cards', cardData);
  if (created?.id) {
    activeCardApplicationByPost.set(postId, {
      id: created.id,
      cardNumber,
      cardType,
      discountType: cardData.discountType,
    });
  }

  if (postState) {
    await apiRequest('PATCH', `/api/crm/post-states/${postState.id}`, {
      balance: cardData.balance,
      discount: cardData.discount,
      lastMessageAt: new Date().toISOString(),
    });
  }
}

async function upsertUsageStat(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  const period = String(payload.period || 'before_collection');
  const category = String(payload.category || 'regular');
  const discountType =
    payload.discountType != null && String(payload.discountType).trim()
      ? String(payload.discountType).trim()
      : undefined;
  const stats = await apiRequest<
    Array<{ id: string; postId: unknown; period: string; category: string; discountType?: string }>
  >('GET', '/api/crm/usage-stats?limit=500');
  const existing = stats.find(
    (s) =>
      refId(s.postId) === postId &&
      s.period === period &&
      s.category === category &&
      (s.discountType?.trim() || '') === (discountType || '')
  );

  const data: Record<string, unknown> = {
    washId,
    postId,
    period,
    category,
    launchCount: Number(payload.launchCount ?? payload.launch_count ?? 0),
    usageTime: Number(payload.usageTime ?? payload.usage_time ?? 0),
    avgWashTime: Number(payload.avgWashTime ?? payload.avg_wash_time ?? 0),
    clientCount: Number(payload.clientCount ?? payload.client_count ?? 0),
    recordedAt,
  };
  if (discountType) data.discountType = discountType;

  if (existing) {
    await apiRequest('PATCH', `/api/crm/usage-stats/${existing.id}`, data);
  } else {
    await apiRequest('POST', '/api/crm/usage-stats', data);
  }
}

async function upsertFinanceStat(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  const period = String(payload.period || 'before_collection');
  const stats = await apiRequest<Array<{ id: string; postId: unknown; period: string }>>(
    'GET',
    '/api/crm/finance-stats?limit=500'
  );
  const existing = stats.find((s) => refId(s.postId) === postId && s.period === period);

  const data = {
    washId,
    postId,
    period,
    cash: Number(payload.cash ?? 0),
    cashless: Number(payload.cashless ?? 0),
    discountOps: Number(payload.discountOps ?? payload.discount_ops ?? 0),
    totalRevenue: Number(payload.totalRevenue ?? payload.total_revenue ?? 0),
    avgCheck: Number(payload.avgCheck ?? payload.avg_check ?? 0),
    recordedAt,
  };

  if (existing) {
    await apiRequest('PATCH', `/api/crm/finance-stats/${existing.id}`, data);
  } else {
    await apiRequest('POST', '/api/crm/finance-stats', data);
  }
}

function refId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const obj = value as { id?: string; _id?: string };
    return String(obj.id ?? obj._id ?? '');
  }
  return String(value);
}

async function handleUsageStats(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  await upsertUsageStat(washId, postId, payload, recordedAt);
}

async function handleFinanceStats(
  washId: string,
  postId: string,
  payload: Record<string, unknown>,
  recordedAt: string
): Promise<void> {
  await upsertFinanceStat(washId, postId, payload, recordedAt);
}

async function handleEquipment(
  postId: string,
  washId: string,
  payload: Record<string, unknown>,
  receivedAt: string
): Promise<void> {
  const hasError = Boolean(payload.error || payload.hasError);

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
    await createNotification({
      type: 'equipment_error',
      severity: 'error',
      washId,
      postId,
      message: String(payload.message || payload.error || 'Ошибка оборудования на посте'),
    });
  }
}

async function handleEvent(
  postId: string,
  washId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const eventType = String(payload.eventType || payload.type || 'connection_lost');

  if (eventType === 'credit') {
    const amount = Number(payload.amount ?? payload.summ ?? 0);
    const creditType = Number(payload.creditType ?? payload.type ?? 0);
    const creditLabels = ['наличные', 'безнал', 'скидка'];
    const label = creditLabels[creditType] ?? `тип ${creditType}`;

    const postState = await findPostState(postId);
    const patch: Record<string, unknown> = {
      lastMessageAt: new Date().toISOString(),
      connected: true,
    };

    if (creditType === 2) {
      patch.discount = Number(postState?.discount ?? 0) + amount;
    } else {
      patch.balance = Number(postState?.balance ?? 0) + amount;
    }

    if (postState) {
      await apiRequest('PATCH', `/api/crm/post-states/${postState.id}`, patch);
    } else {
      await apiRequest('POST', '/api/crm/post-states', { postId, washId, ...patch });
    }

    await createNotification({
      type: 'mqtt_credit',
      severity: 'info',
      washId,
      postId,
      message: String(payload.message || `Зачисление ${amount} ₽ (${label})`),
    });
    return;
  }

  if (eventType === 'connection_lost') {
    const existing = await findPostState(postId);
    if (existing) {
      await apiRequest('PATCH', `/api/crm/post-states/${existing.id}`, {
        connected: false,
        lastMessageAt: new Date().toISOString(),
      });
    } else {
      await apiRequest('POST', '/api/crm/post-states', {
        postId,
        washId,
        connected: false,
        lastMessageAt: new Date().toISOString(),
      });
    }

    await createNotification({
      type: 'connection_lost',
      severity: 'warning',
      washId,
      postId,
      message: String(payload.message || 'Потеря связи с постом'),
    });
    return;
  }
}
