// Deploy: npx supabase functions deploy auth-handoff --project-ref vewtnkewyawmkpeymdot --no-verify-jwt
//
// "Đăng nhập bằng tài khoản Tài Sản Đấu Giá" trên Sàn đấu giá trực tuyến
// (docs/auction-platform-split-plan.md 4.3). Hai nền tảng dùng chung auth.users
// nhưng khác origin ⇒ khác localStorage ⇒ phải đăng nhập lại. Hàm này chuyển
// phiên đăng nhập sang sàn bằng một MÃ MỘT LẦN, không bao giờ đưa access/refresh
// token lên URL.
//
// Luồng:
//   1. Sàn sinh `state` ngẫu nhiên (giữ trong sessionStorage của tab), chuyển sang
//      taisandaugia /dang-nhap/san-dau-gia?state=…
//   2. taisandaugia (đã đăng nhập) gọi { action: "create", state } kèm JWT người dùng
//      → nhận `code` (60 s, dùng 1 lần) → chuyển về sàn /auth/handoff#code=…
//      (fragment: không gửi lên server, không lọt Referer).
//   3. Sàn gọi { action: "exchange", code, state } (không cần JWT) → nhận
//      `token_hash` của magic link (admin generateLink, KHÔNG gửi email) →
//      supabase.auth.verifyOtp({ token_hash, type: "magiclink" }) ⇒ có session.
//
// Bảo mật: chỉ lưu băm SHA-256 của code và state (bảng auth_handoff_codes, chỉ
// service_role đọc/ghi). `state` buộc mã vào đúng tab đã bắt đầu luồng ⇒ kẻ gian
// không thể gửi cho nạn nhân một link chứa mã của tài khoản kẻ gian (login CSRF).
// Đích chuyển về là tên miền sàn cố định trong env của taisandaugia, không lấy từ
// tham số. verify_jwt TẮT vì exchange gọi bằng anon; create tự kiểm JWT.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY được nền tảng Supabase tự tiêm.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CODE_TTL_SECONDS = 60
/** Mã đã hết hạn được dọn sau khoảng này (giữ lại một chút để tra cứu sự cố). */
const PURGE_AFTER_MS = 60 * 60 * 1000
const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/
const CODE_RE = /^[A-Za-z0-9_-]{43}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const fail = (code: string, message: string, status = 400) => json({ error: code, message }, status)

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 32 byte ngẫu nhiên → 43 ký tự base64url. */
function randomCode(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

interface Body {
  action?: 'create' | 'exchange'
  state?: string
  code?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('method_not_allowed', 'Chỉ hỗ trợ POST', 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return fail('bad_request', 'Yêu cầu không hợp lệ')
  }

  const state = typeof body.state === 'string' ? body.state : ''
  if (!STATE_RE.test(state)) return fail('bad_state', 'Liên kết đăng nhập không hợp lệ')

  try {
    // ─── create: người dùng ĐÃ đăng nhập taisandaugia xin mã cho sàn ──────────
    if (body.action === 'create') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: userData, error: userErr } = await admin.auth.getUser(token)
      if (userErr || !userData?.user) {
        return fail('not_authenticated', 'Bạn chưa đăng nhập Tài Sản Đấu Giá', 401)
      }

      const code = randomCode()
      const now = Date.now()
      const { error: insErr } = await admin.from('auth_handoff_codes').insert({
        code_hash: await sha256Hex(code),
        user_id: userData.user.id,
        state_hash: await sha256Hex(state),
        target_platform: 'auction',
        expires_at: new Date(now + CODE_TTL_SECONDS * 1000).toISOString(),
      })
      if (insErr) throw insErr

      // Dọn mã cũ — lỗi ở đây không ảnh hưởng luồng đăng nhập.
      await admin
        .from('auth_handoff_codes')
        .delete()
        .lt('expires_at', new Date(now - PURGE_AFTER_MS).toISOString())

      return json({ code, expires_in: CODE_TTL_SECONDS })
    }

    // ─── exchange: sàn đổi mã lấy token_hash của magic link ───────────────────
    if (body.action === 'exchange') {
      const code = typeof body.code === 'string' ? body.code : ''
      if (!CODE_RE.test(code)) return fail('invalid_code', 'Mã đăng nhập không hợp lệ hoặc đã hết hạn')

      // Một câu UPDATE có điều kiện ⇒ hai request đồng thời không dùng được cùng một mã.
      const { data: used, error: useErr } = await admin
        .from('auth_handoff_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('code_hash', await sha256Hex(code))
        .eq('state_hash', await sha256Hex(state))
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('user_id')
      if (useErr) throw useErr
      const userId = used?.[0]?.user_id
      if (!userId) return fail('invalid_code', 'Mã đăng nhập không hợp lệ hoặc đã hết hạn')

      const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId)
      if (getErr || !target?.user) return fail('user_not_found', 'Không tìm thấy tài khoản', 404)
      const email = target.user.email
      if (!email) return fail('no_email', 'Tài khoản chưa có email — vui lòng đăng nhập trực tiếp trên sàn')

      // Chỉ sinh link (không gửi email). Tài khoản bị khoá ⇒ verifyOtp phía sàn sẽ từ chối.
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
      const tokenHash = link?.properties?.hashed_token
      if (linkErr || !tokenHash) throw linkErr ?? new Error('generateLink không trả về hashed_token')

      return json({ token_hash: tokenHash, type: 'magiclink' })
    }

    return fail('bad_action', 'Thao tác không hợp lệ')
  } catch (err) {
    console.error('auth-handoff', err)
    return fail('server_error', 'Không thể đăng nhập liên kết, vui lòng thử lại', 500)
  }
})
