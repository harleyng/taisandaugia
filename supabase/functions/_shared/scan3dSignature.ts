// Chữ ký webhook đối tác quét 3D: HMAC-SHA256(secret, `${timestamp}.${rawBody}`), hex.
// Dùng chung cho scan3d-webhook (xác thực) và công cụ thử (ký). Chỉ Web Crypto —
// chạy được cả trên Deno lẫn Node ≥ 20.

export const SIGNATURE_PREFIX = 'sha256='
/** Lệch đồng hồ tối đa — chặn phát lại một request cũ đã bị bắt được. */
export const MAX_SKEW_SECONDS = 300

const encoder = new TextEncoder()

export async function sign(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`))
  return SIGNATURE_PREFIX + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** So sánh thời gian hằng — không để lộ chữ ký đúng dần qua thời gian phản hồi. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifySignature(args: {
  secret: string
  rawBody: string
  timestamp: string | null
  signature: string | null
  nowSeconds?: number
}): Promise<{ ok: true } | { ok: false; reason: 'missing_signature' | 'stale_timestamp' | 'bad_signature' }> {
  const { secret, rawBody, timestamp, signature } = args
  if (!timestamp || !signature) return { ok: false, reason: 'missing_signature' }

  const ts = Number(timestamp)
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (!Number.isInteger(ts) || Math.abs(now - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale_timestamp' }

  const expected = await sign(secret, timestamp, rawBody)
  return timingSafeEqual(expected, signature.trim().toLowerCase()) ? { ok: true } : { ok: false, reason: 'bad_signature' }
}
