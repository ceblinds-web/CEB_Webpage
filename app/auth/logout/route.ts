import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  // Use the request's own origin rather than an env var that was never set —
  // this works correctly no matter which URL you're actually on (the
  // .vercel.app domain, an alias, or ceblinds.click later), with nothing to
  // configure.
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
