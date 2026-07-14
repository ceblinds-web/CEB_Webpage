import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const numericFields = ['price_cordless','price_beadchain','price_cordless_tdbu','price_cordless_daynight','price_lock_tdbu','price_lock_daynight','price_adjustment']
  for (const f of numericFields) {
    if (body[f] !== undefined) update[f] = body[f] === null || body[f] === '' ? null : Number(body[f])
  }
  if (body.notes !== undefined) update.notes = body.notes
  if (body.description !== undefined) update.description = body.description
  if (body.fabric_codes !== undefined) update.fabric_codes = body.fabric_codes

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('vendor_catalog').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
