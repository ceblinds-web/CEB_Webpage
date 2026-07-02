// lib/require-admin.ts
// Every API route that touches project/customer/financial data should call this
// FIRST, before doing anything with createAdminClient(). Route handlers were
// using the service-role client (which bypasses RLS) with no check that the
// caller is even logged in — this closes that gap.
import { createClient } from '@/lib/supabase-server'

export async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles').select('role, email, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin only' }

  return {
    ok: true as const,
    userId: user.id,
    actor: profile.email ?? profile.full_name ?? user.id,
  }
}
