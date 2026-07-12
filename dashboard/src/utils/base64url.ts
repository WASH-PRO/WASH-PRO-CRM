const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64ToBytes(base64: string): Uint8Array | null {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!cleaned || cleaned.length % 4 === 1) return null;

  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const chunk = cleaned.slice(i, i + 4);
    const a = BASE64_ALPHABET.indexOf(chunk[0] ?? '');
    const b = BASE64_ALPHABET.indexOf(chunk[1] ?? '');
    const c = chunk[2] === '=' ? -1 : BASE64_ALPHABET.indexOf(chunk[2] ?? '');
    const d = chunk[3] === '=' ? -1 : BASE64_ALPHABET.indexOf(chunk[3] ?? '');
    if (a < 0 || b < 0 || (chunk[2] !== '=' && c < 0) || (chunk[3] !== '=' && d < 0)) return null;

    const triple = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    bytes.push((triple >> 16) & 0xff);
    if (chunk[2] !== '=') bytes.push((triple >> 8) & 0xff);
    if (chunk[3] !== '=') bytes.push(triple & 0xff);
  }

  return Uint8Array.from(bytes);
}

/** Decode JWT/base64url payload without relying on Safari atob(). */
export function decodeBase64Url(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;

  if (typeof globalThis.atob === 'function') {
    try {
      const binary = globalThis.atob(padded);
      return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
    } catch {
      // fall through to manual decoder
    }
  }

  const bytes = decodeBase64ToBytes(padded);
  if (!bytes) throw new Error('Invalid base64url');
  return new TextDecoder().decode(bytes);
}
