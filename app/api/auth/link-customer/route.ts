import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Called right after signUp (if a session comes back immediately) and again after
// every login, as a guaranteed fallback for accounts where email confirmation
// delayed the first session. Always operates on the CALLER's OWN authenticated
// identity (never a client-supplied email/id) — a customer can only ever end up
// linked to a customers row that matches their own verified login email.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()

  // Ensure a profiles row exists for this login, regardless of whether a DB
  // trigger already creates one — this is a no-op if it does.
  const { data: existingProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      full_name: (user.user_metadata as any)?.full_name ?? null,
      phone: (user.user_metadata as any)?.phone ?? null,
      role: 'customer',
    })
  }

  // Admins don't need a customers-row link.
  const role = existingProfile?.role ?? 'customer'
  if (role === 'admin') return NextResponse.json({ linked: false, isAdmin: true })

  // Already linked? Nothing to do.
  const { data: alreadyLinked } = await admin.from('customers').select('id').eq('profile_id', user.id).maybeSingle()
  if (alreadyLinked) return NextResponse.json({ linked: true, alreadyLinked: true })

  // Find a customer record CEB created for this exact email that hasn't been
  // claimed by any login yet, and link it.
  const { data: matchingCustomer } = await admin
    .from('customers').select('id').eq('email', user.email).is('profile_id', null).maybeSingle()

  if (!matchingCustomer) {
    return NextResponse.json({ linked: false, noMatch: true })
  }

  const { error: linkErr } = await admin.from('customers').update({ profile_id: user.id }).eq('id', matchingCustomer.id)
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

  return NextResponse.json({ linked: true, alreadyLinked: false })
}
