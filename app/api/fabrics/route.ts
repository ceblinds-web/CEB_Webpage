import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

// Read is available to anyone signed in (admin or customer) — the project
// sheet's Fabric dropdown needs this for both. Write is admin-only.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await supabase.from('fabrics').select('*').eq('is_active', true).order('series').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { code, series, vendor, category, cost_cordless, cost_beadchain } = await req.json()
  if (!code || !series) return NextResponse.json({ error: 'code and series are required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('fabrics').insert({
    code: String(code).toUpperCase().trim(),
    series: String(series).trim(),
    vendor: vendor || null,
    category: category || 'zebra',
    cost_cordless: Number(cost_cordless) || 0,
    cost_beadchain: Number(cost_beadchain) || 0,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
