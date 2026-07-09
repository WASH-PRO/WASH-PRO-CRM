import type { MessageTree } from './types';

export function translate(
  messages: MessageTree,
  key: string,
  params?: Record<string, string | number>
): string {
  const parts = key.split('.');
  let node: unknown = messages;
  for (const part of parts) {
    if (node == null || typeof node !== 'object' || !(part in (node as MessageTree))) {
      return key;
    }
    node = (node as MessageTree)[part];
  }
  if (typeof node !== 'string') return key;
  if (!params) return node;
  return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}
