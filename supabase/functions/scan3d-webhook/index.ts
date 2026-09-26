// Deploy: npx supabase functions deploy scan3d-webhook --project-ref vewtnkewyawmkpeymdot --no-verify-jwt
// Secret: npx supabase secrets set SCAN3D_WEBHOOK_SECRET=<chuỗi ngẫu nhiên ≥32 ký tự> --project-ref vewtnkewyawmkpeymdot
//
// Webhook đối tác quét 3D gọi về khi xử lý xong một phiên quét. Đây là webhook
// NGOÀI đầu tiên của dự án nên không có JWT người dùng: xác thực bằng chữ ký HMAC
// (verify_jwt = false trong supabase/config.toml).
//
// Hợp đồng:
//   POST, header
//     X-Scan3D-Timestamp: <unix giây>
//     X-Scan3D-Signature: sha256=<hex HMAC-SHA256(SECRET, `${timestamp}.${rawBody}`)>
//   body JSON
//     { event: "scan.processing" | "model.ready" | "scan.failed",
//       job_id: string,            // id job phía đối tác — khoá idempotent
//       scan_ref: uuid,            // asset_3d_scans.id, nhận qua deeplink
//       lot_id: uuid,              // asset_postings.id, nhận qua deeplink (BR-3D-02)
//       model_url?: https URL,     // bắt buộc với model.ready
//       poster_url?: https URL,
//       format?: "glb" | "usdz" | "embed",
//       reason?: string }          // với scan.failed
//
// Mọi luật nghiệp vụ (lot_id khớp, idempotent, hoàn credit, chưa công khai) nằm ở
// hàm SQL — function này chỉ xác thực chữ ký rồi chuyển tiếp bằng service_role.
// Phản hồi: 200 ok/duplicate · 400 payload sai · 401 chữ ký/timestamp sai ·
// 404 không có phiên quét · 409 lot_id/job lệch hoặc trạng thái không nhận được.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifySignature } from '../_shared/scan3dSignature.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORMATS = new Set(['glb', 'usdz', 'embed'])

interface Payload {
  event?: string
  job_id?: string
  scan_ref?: string
  lot_id?: string
  model_url?: string
  poster_url?: string
  format?: string
  reason?: string
}

const isHttps = (v: unknown): v is string => {
  if (typeof v !== 'string') return false
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

const STATUS_BY_REASON: Record<string, number> = {
  scan_not_found: 404,
  lot_mismatch: 409,
  job_mismatch: 409,
  job_conflict: 409,
  invalid_status: 409,
  invalid_format: 400,
  invalid_url: 400,
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('SCAN3D_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'not_configured' }, 500)

  // Đọc body THÔ: chữ ký tính trên đúng từng byte đối tác gửi, parse trước thì hỏng.
  const rawBody = await req.text()
  const verdict = await verifySignature({
    secret,
    rawBody,
    timestamp: req.headers.get('x-scan3d-timestamp'),
    signature: req.headers.get('x-scan3d-signature'),
  })
  if (!verdict.ok) return json({ error: verdict.reason }, 401)

  let body: Payload
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { event, job_id, scan_ref, lot_id } = body
  if (!job_id || typeof job_id !== 'string' || job_id.length > 200) return json({ error: 'invalid_job_id' }, 400)
  if (!scan_ref || !UUID_RE.test(scan_ref)) return json({ error: 'invalid_scan_ref' }, 400)
  if (!lot_id || !UUID_RE.test(lot_id)) return json({ error: 'invalid_lot_id' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let rpc
  if (event === 'scan.processing') {
    rpc = await admin.rpc('mark_asset_3d_processing', { _scan_id: scan_ref, _lot_id: lot_id, _job_id: job_id })
  } else if (event === 'model.ready') {
    if (!isHttps(body.model_url)) return json({ error: 'invalid_model_url' }, 400)
    if (body.poster_url != null && !isHttps(body.poster_url)) return json({ error: 'invalid_poster_url' }, 400)
    if (!body.format || !FORMATS.has(body.format)) return json({ error: 'invalid_format' }, 400)
    rpc = await admin.rpc('attach_asset_3d_model', {
      _scan_id: scan_ref,
      _lot_id: lot_id,
      _job_id: job_id,
      _model_url: body.model_url,
      _poster_url: body.poster_url ?? null,
      _format: body.format,
    })
  } else if (event === 'scan.failed') {
    rpc = await admin.rpc('fail_asset_3d_scan', {
      _scan_id: scan_ref,
      _lot_id: lot_id,
      _job_id: job_id,
      _reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
    })
  } else {
    return json({ error: 'unknown_event' }, 400)
  }

  if (rpc.error) {
    console.error('scan3d-webhook rpc error', rpc.error)
    return json({ error: 'internal_error' }, 500)
  }

  const result = rpc.data as { ok: boolean; reason?: string } & Record<string, unknown>
  if (!result?.ok) {
    const reason = result?.reason ?? 'rejected'
    console.warn('scan3d-webhook rejected', { event, scan_ref, lot_id, job_id, reason })
    return json(result, STATUS_BY_REASON[reason] ?? 409)
  }
  return json(result, 200)
})
