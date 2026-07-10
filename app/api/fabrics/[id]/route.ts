import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.code !== undefined) update.code = String(body.code).toUpperCase().trim()
  if (body.series !== undefined) update.series = body.series
  if (body.vendor !== undefined) update.vendor = body.vendor
  if (body.category !== undefined) update.category = body.category
  if (body.cost_cordless !== undefined) update.cost_cordless = Number(body.cost_cordless) || 0
  if (body.cost_beadchain !== undefined) update.cost_beadchain = Number(body.cost_beadchain) || 0
  if (body.is_active !== undefined) update.is_active = !!body.is_active

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('fabrics').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Soft-delete only (is_active=false) — a real DELETE could break historical
// project rows that already reference this fabric code. "Not available
// anymore" just hides it from the picker going forward.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('fabrics').update({ is_active: false }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
