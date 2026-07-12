// Deploy: npx supabase functions deploy admin-user-actions --project-ref dvdpfjprncvkhfwcvqmp
//
// Privileged admin user-management actions that require the GoTrue admin API
// (service_role) — these cannot run client-side (would leak the key) or as a
// Postgres function. Every call is gated: the caller's JWT must belong to a
// user with the ADMIN role in public.user_roles.
//
// Actions (dispatched by body.action):
//   create       → auth.admin.createUser with a random password (no email
//                  sent), marks the new profile activated, then generates a
//                  recovery action link so the user can set their own password.
//                  The link is RETURNED to the admin (never emailed) — the
//                  project has no custom SMTP, so we never rely on Supabase mail.
//   set_password → auth.admin.updateUserById({ password }) — admin resets a
//                  user's password directly (no email).
//   lock         → auth.admin.updateUserById(ban_duration) + profiles.status='locked'
//   unlock       → auth.admin.updateUserById(ban_duration:'none') + status='active'
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into deployed
// functions by the Supabase platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Strong-ish random password (mật khẩu tạm — user sẽ tự đặt lại qua link).
// Bỏ ký tự dễ nhầm (0/O, 1/l/I). Đảm bảo có đủ 3 nhóm ký tự.
function randomPassword(len = 14): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = lower + upper + digits
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += all[bytes[i] % all.length]
  return (
    out.slice(0, len - 3) +
    lower[bytes[0] % lower.length] +
    upper[bytes[1] % upper.length] +
    digits[bytes[2] % digits.length]
  )
}

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

// Effectively-permanent ban (~100 years). 'none' lifts it.
const PERMANENT_BAN = '876000h'

interface Body {
  action?: 'create' | 'set_password' | 'lock' | 'unlock'
  email?: string
  name?: string
  makeAdmin?: boolean
  userId?: string
  password?: string
  redirectTo?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // ─── Verify caller is an ADMIN ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'missing_token' }, 401)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'invalid_token' }, 401)

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'ADMIN')
      .maybeSingle()
    if (!roleRow) return json({ error: 'not_authorized' }, 403)

    // ─── Dispatch ───────────────────────────────────────────────────────────
    const body = (await req.json()) as Body
    const action = body.action

    if (action === 'create') {
      const email = (body.email ?? '').trim().toLowerCase()
      const name = (body.name ?? '').trim()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'invalid_email' }, 400)
      }

      // Create a confirmed user with a throwaway random password — no email is
      // sent (unlike inviteUserByEmail). The user sets their own password via
      // the recovery link below.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { name },
      })
      if (createErr || !created?.user) {
        // Most common: email already registered.
        return json({ error: 'create_failed', message: createErr?.message ?? 'unknown' }, 400)
      }

      const newId = created.user.id
      // The handle_new_user trigger created the profile; mark it activated
      // (admin-created accounts skip the top-up activation gate) + set name.
      await admin
        .from('profiles')
        .update({ activated: true, activated_at: new Date().toISOString(), name: name || null })
        .eq('id', newId)

      if (body.makeAdmin) {
        await admin
          .from('user_roles')
          .upsert({ user_id: newId, role: 'ADMIN' }, { onConflict: 'user_id,role', ignoreDuplicates: true })
      }

      // Generate (but do NOT email) a recovery link so the user lands directly
      // in the set-password flow. Admin copies this and delivers it themselves.
      let actionLink: string | null = null
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: body.redirectTo },
      })
      actionLink = linkData?.properties?.action_link ?? null

      return json({ ok: true, userId: newId, email, actionLink })
    }

    if (action === 'set_password') {
      const userId = body.userId
      const password = body.password ?? ''
      if (!userId) return json({ error: 'missing_user_id' }, 400)
      if (password.length < 6) return json({ error: 'weak_password' }, 400)

      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (pwErr) return json({ error: 'set_password_failed', message: pwErr.message }, 400)

      return json({ ok: true, userId })
    }

    if (action === 'lock' || action === 'unlock') {
      const userId = body.userId
      if (!userId) return json({ error: 'missing_user_id' }, 400)
      if (userId === userData.user.id) return json({ error: 'cannot_lock_self' }, 400)

      const banDuration = action === 'lock' ? PERMANENT_BAN : 'none'
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      })
      if (banErr) return json({ error: 'ban_failed', message: banErr.message }, 400)

      await admin
        .from('profiles')
        .update({ status: action === 'lock' ? 'locked' : 'active' })
        .eq('id', userId)

      return json({ ok: true, userId, status: action === 'lock' ? 'locked' : 'active' })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: 'internal_error', message }, 500)
  }
})
