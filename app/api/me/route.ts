import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Returns who's currently signed in (or null) — used by the session bar on
// every page to show a name + Sign Out, or a Sign In link if nobody's
// logged in. Deliberately public (no requireAdmin) since this just answers
// "who am I", not a data request.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ signedIn: false })

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  return NextResponse.json({
    signedIn: true,
    name: profile?.full_name || profile?.email || user.email,
    role: profile?.role || 'customer',
  })
}
