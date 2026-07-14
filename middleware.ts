import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  // Public routes — no auth needed
  if (path.startsWith('/auth') || path.startsWith('/quote') || path.startsWith('/catalog')) {
    return supabaseResponse
  }
  // Not logged in → root goes to the public catalog (this IS the landing
  // page now), everything else still goes to login
  if (!user) {
    if (path === '/') return NextResponse.redirect(new URL('/catalog', request.url))
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  // Admin routes — check role
  if (path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/customer', request.url))
    }
  }
  return supabaseResponse
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
