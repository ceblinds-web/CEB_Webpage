import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.my_cost_per_sqm !== undefined) update.my_cost_per_sqm = body.my_cost_per_sqm
  if (body.factor !== undefined) update.factor = body.factor
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('products').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
