const startedAt = Date.now();

let messagesProcessed = 0;
let dlqLogged = 0;

export function incMessagesProcessed(count = 1): void {
  messagesProcessed += count;
}

export function incDlqLogged(count = 1): void {
  dlqLogged += count;
}

export function getProcessorMetrics(): {
  messagesProcessed: number;
  dlqLogged: number;
  uptimeSec: number;
} {
  return {
    messagesProcessed,
    dlqLogged,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  };
}
