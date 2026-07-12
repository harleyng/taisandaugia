// Deploy: npx supabase functions deploy admin-user-actions --project-ref dvdpfjprncvkhfwcvqmp
//
// Privileged admin user-management actions that require the GoTrue admin API
// (service_role) — these cannot run client-side (would leak the key) or as a
// Postgres function. Every call is gated: the caller's JWT must belong to a
// user with the ADMIN role in public.user_roles.
//
// Actions (dispatched by body.action):
//   create → auth.admin.inviteUserByEmail (creates user + sends set-password
//            email), then marks the new profile activated.
//   lock   → auth.admin.updateUserById(ban_duration) + profiles.status='locked'
//   unlock → auth.admin.updateUserById(ban_duration:'none') + status='active'
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into deployed
// functions by the Supabase platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  action?: 'create' | 'lock' | 'unlock'
  email?: string
  name?: string
  makeAdmin?: boolean
  userId?: string
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

      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo: body.redirectTo,
      })
      if (inviteErr || !invited?.user) {
        // Most common: email already registered.
        return json({ error: 'invite_failed', message: inviteErr?.message ?? 'unknown' }, 400)
      }

      const newId = invited.user.id
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

      return json({ ok: true, userId: newId, email })
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
