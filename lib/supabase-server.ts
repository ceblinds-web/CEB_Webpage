import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// IMPORTANT FIX: the original createClient() only provided a `get` cookie handler.
// @supabase/ssr needs `set` and `remove` too — without them, when your access token
// expires mid-session and the client tries to silently refresh it, it can't persist
// the new token back into cookies. getUser()/getSession() then start returning stale
// or null results server-side, even though you're still logged in in the browser.
// This is the most likely explanation for mutations (Mark Paid, Resolve Grievance,
// etc.) working right after login and then silently failing later in the same
// session: those routes all check auth via getUser() before doing anything.
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // set() throws if called from a Server Component render (which can't
            // mutate cookies) — safe to ignore there; middleware/route handlers
            // that actually need the refreshed token can still set it.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // same as above
          }
        },
      },
    }
  )
}

// Service role client — bypasses RLS. Use only in API routes, never client-side.
// No session refresh needed here since the service role key isn't a user session,
// but the same shape is kept for consistency.
export function createAdminClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
}
