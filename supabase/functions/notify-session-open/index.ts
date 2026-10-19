// Deploy: npx supabase functions deploy notify-session-open --project-ref vewtnkewyawmkpeymdot
//
// Gửi email "phiên đã mở bán hồ sơ" cho người bấm "Nhận thông báo khi mở bán" ở
// /sessions/:id (bảng session_open_watchers, migration 20261018150000).
//
// Gọi định kỳ (mỗi phút) bởi bộ lập lịch, KHÔNG phải từ trình duyệt:
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Mỗi lần chạy: lấy đăng ký chưa gửi của phiên đã tới giờ mở bán, gửi email, đặt
// notified_at. Phiên đã huỷ / gỡ ⇒ đặt notified_at kèm last_error, không gửi.
//
// Nhà cung cấp email: Resend (RESEND_API_KEY + EMAIL_FROM, vd.
// "Tài Sản Đấu Giá <no-reply@taisandaugia.vn>"). Thiếu khoá ⇒ chế độ STUB: chỉ
// trả danh sách sẽ gửi, KHÔNG đặt notified_at (để gửi thật khi có khoá).
// PUBLIC_SITE_URL dựng link về trang phiên — tên miền Sàn đấu giá trực tuyến (trang
// phiên ở repo taisanviet từ Phase 5; taisandaugia.vn/sessions/* chỉ còn chuyển hướng).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH = 100

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

interface DueRow {
  id: string
  email: string
  session_id: string
  auction_sessions: {
    code: string | null
    title: string
    status: string
    registration_start_at: string | null
    registration_end_at: string | null
    dossier_fee: number | null
  } | null
}

function renderEmail(row: DueRow, siteUrl: string) {
  const s = row.auction_sessions!
  const link = `${siteUrl.replace(/\/$/, '')}/sessions/${row.session_id}`
  const fee = s.dossier_fee ? `${Math.round(s.dossier_fee).toLocaleString('en-US')} ₫` : null
  const deadline = s.registration_end_at
    ? new Date(s.registration_end_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : null
  const subject = `Đã mở bán hồ sơ: ${s.title}`
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">
<p>Phiên đấu giá bạn theo dõi đã mở bán hồ sơ tham gia:</p>
<p style="font-size:16px;font-weight:600;margin:12px 0">${esc(s.title)}${s.code ? ` <span style="color:#64748b;font-weight:400">(${esc(s.code)})</span>` : ''}</p>
${fee ? `<p>Giá hồ sơ: <b>${fee}</b></p>` : ''}
${deadline ? `<p>Hạn mua hồ sơ: <b>${esc(deadline)}</b></p>` : ''}
<p style="margin:20px 0"><a href="${link}" style="background:#1b6b45;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Mua hồ sơ tham gia</a></p>
<p style="color:#64748b;font-size:12px">Bạn nhận email này vì đã bấm “Nhận thông báo khi mở bán” trên Tài Sản Đấu Giá. Email chỉ gửi một lần cho phiên này.</p>
</div>`
  return { subject, html }
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return json({ error: 'forbidden' }, 403)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
    auth: { persistSession: false },
  })
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const from = Deno.env.get('EMAIL_FROM') ?? ''
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://taisanviet.vercel.app'
  const stub = !resendKey || !from

  const { data, error } = await admin
    .from('session_open_watchers')
    .select(
      'id, email, session_id, auction_sessions!inner(code, title, status, registration_start_at, registration_end_at, dossier_fee)',
    )
    .is('notified_at', null)
    .lte('auction_sessions.registration_start_at', new Date().toISOString())
    .limit(BATCH)
  if (error) return json({ error: error.message }, 500)

  const rows = (data ?? []) as unknown as DueRow[]
  const result = { stub, sent: 0, skipped: 0, failed: 0, pending: [] as string[] }

  for (const row of rows) {
    const s = row.auction_sessions
    if (!s || s.status !== 'published') {
      await admin
        .from('session_open_watchers')
        .update({ notified_at: new Date().toISOString(), last_error: 'session_not_published' })
        .eq('id', row.id)
      result.skipped++
      continue
    }
    if (stub) {
      result.pending.push(row.id)
      continue
    }
    const { subject, html } = renderEmail(row, siteUrl)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [row.email], subject, html }),
    })
    if (res.ok) {
      await admin
        .from('session_open_watchers')
        .update({ notified_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
      result.sent++
    } else {
      await admin
        .from('session_open_watchers')
        .update({ last_error: `resend_${res.status}: ${(await res.text()).slice(0, 300)}` })
        .eq('id', row.id)
      result.failed++
    }
  }

  return json(result)
})
