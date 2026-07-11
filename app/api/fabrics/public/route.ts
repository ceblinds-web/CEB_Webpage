import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Deliberately separate from /api/fabrics (which requires sign-in and is used
// by the admin/customer project pricing tools). This one is public — no auth
// — for the catalog landing page, and only ever returns code/series/category.
// Wholesale cost is never exposed here, same security posture as everywhere
// else in the app that shows fabric-driven pricing to non-admins.
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('fabrics').select('code, series, category').eq('is_active', true).order('series').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
