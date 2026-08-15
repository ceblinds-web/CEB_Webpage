import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import { getMergedPricing } from '@/lib/project-pricing'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const merged = await getMergedPricing(params.id)
  return NextResponse.json(merged)
}

// PATCH { type:'product'|'motor', name, field:'cost'|'factor', value }
// Live-edit save target (replaces the old direct-to-global-table PATCH).
// Reads the CURRENT effective value (override or default), applies the one
// changed field, and writes a project-scoped override — never the global row.
// If the result now matches the default exactly, the override is removed.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { type, name, field, value } = body
  if (!type || !name || !field || value === undefined)
    return NextResponse.json({ error: 'type, name, field, value are required' }, { status: 400 })

  const sb = createAdminClient()
  const isMotor = type === 'motor'
  const table = isMotor ? 'project_motors' : 'project_products'
  const costCol = isMotor ? 'my_cost_per_unit' : 'my_cost_per_sqm'
  const defaultTable = isMotor ? 'motors' : 'products'

  const [{ data: def }, { data: existing }] = await Promise.all([
    sb.from(defaultTable).select('*').eq('name', name).maybeSingle(),
    sb.from(table).select('*').eq('project_id', params.id).eq('name', name).maybeSingle(),
  ])
  if (!def) return NextResponse.json({ error: `No default ${type} named "${name}" found` }, { status: 404 })

  const current = {
    cost: existing ? Number(existing[costCol]) : Number(def[costCol]),
    factor: existing ? Number(existing.factor) : Number(def.factor),
  }
  const updated = field === 'factor' ? { ...current, factor: Number(value) } : { ...current, cost: Number(value) }

  const matchesDefault = updated.cost === Number(def[costCol]) && updated.factor === Number(def.factor)
  if (matchesDefault) {
    if (existing) await sb.from(table).delete().eq('project_id', params.id).eq('name', name)
    return NextResponse.json({ ok: true, isOverride: false, cost: updated.cost, factor: updated.factor })
  }

  const { error } = await sb.from(table).upsert(
    { project_id: params.id, name, [costCol]: updated.cost, factor: updated.factor },
    { onConflict: 'project_id,name' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, isOverride: true, cost: updated.cost, factor: updated.factor })
}

// POST { type, name } — removes the override, reverting this project to the default
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await req.json().catch(() => ({}))
  if (!body.type || !body.name) return NextResponse.json({ error: 'type and name required' }, { status: 400 })
  const table = body.type === 'motor' ? 'project_motors' : 'project_products'
  const sb = createAdminClient()
  const { error } = await sb.from(table).delete().eq('project_id', params.id).eq('name', body.name)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
