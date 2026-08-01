import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data: folders, error } = await supabase.from('folders').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Try to include sort_order; fall back gracefully if migration 018 not run yet
  let projs: any[] | null = null
  const withOrder = await supabase.from('projects').select('id,folder_id,sort_order')
  if (!withOrder.error) projs = withOrder.data
  else {
    const basic = await supabase.from('projects').select('id,folder_id')
    projs = basic.data || []
  }

  const mapping: Record<string, string> = {}
  const orders: Record<string, number> = {}
  ;(projs || []).forEach((p: any) => {
    if (p.folder_id) mapping[p.id] = p.folder_id
    if (typeof p.sort_order === 'number') orders[p.id] = p.sort_order
  })
  return NextResponse.json({ folders: folders || [], mapping, orders })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  if (!body.customer_id || !body.name?.trim())
    return NextResponse.json({ error: 'customer_id and name required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('folders')
    .insert({ customer_id: body.customer_id, name: body.name.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
