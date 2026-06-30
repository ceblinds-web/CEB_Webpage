import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
export async function GET() {
  const { data } = await createAdminClient().from('products').select('*').eq('is_active',true).order('sort_order')
  return NextResponse.json(data||[])
}
export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return NextResponse.json({ error:'name required' }, { status:400 })
  const sb = createAdminClient()
  const { data: maxRow } = await sb.from('products').select('sort_order').order('sort_order',{ascending:false}).limit(1).single()
  const { data, error } = await sb.from('products').insert({
    name: body.name,
    my_cost_per_sqm: body.my_cost_per_sqm ?? 15,
    factor: body.factor ?? 5,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
  }).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data, { status:201 })
}
