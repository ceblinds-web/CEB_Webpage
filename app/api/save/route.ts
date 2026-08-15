import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

// Saves rows/config/fees as a draft. Does NOT touch is_pushed, pushed_at,
// grand_total, or global product/motor pricing — Push remains the publish step.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { projectId, config, fees, rows, products, motors } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const sb = createAdminClient()

  const { error: configErr } = await sb.from('project_config')
    .upsert({ project_id: projectId, ...config, updated_at: new Date().toISOString() }, { onConflict: 'project_id' })
  if (configErr) return NextResponse.json({ error: 'Saving pricing config failed: ' + configErr.message }, { status: 500 })

  const { error: feeDelErr } = await sb.from('project_fees').delete().eq('project_id', projectId)
  if (feeDelErr) return NextResponse.json({ error: 'Clearing old fees failed: ' + feeDelErr.message }, { status: 500 })
  if (fees?.length) {
    const { error: feeInsErr } = await sb.from('project_fees').insert(
      fees.map((f: any, i: number) => ({ ...f, project_id: projectId, sort_order: i }))
    )
    if (feeInsErr) return NextResponse.json({ error: 'Saving fees failed: ' + feeInsErr.message }, { status: 500 })
  }

  const { error: rowDelErr } = await sb.from('project_rows').delete().eq('project_id', projectId)
  if (rowDelErr) return NextResponse.json({ error: 'Clearing old rows failed: ' + rowDelErr.message }, { status: 500 })
  if (rows?.length) {
    const { error: rowInsErr } = await sb.from('project_rows').insert(
      rows.map((r: any, i: number) => ({ ...r, project_id: projectId, sort_order: i }))
    )
    if (rowInsErr) return NextResponse.json({ error: 'Saving rows failed: ' + rowInsErr.message }, { status: 500 })
  }

  // Same project-scoped override logic as Push, minus the publish step.
  if (products?.length) {
    const { data: defaults } = await sb.from('products').select('name, my_cost_per_sqm, factor')
    const defMap = new Map((defaults || []).map((d: any) => [d.name, d]))
    for (const p of products) {
      const def = defMap.get(p.name)
      const differs = !def || Number(def.my_cost_per_sqm) !== Number(p.my_cost_per_sqm) || Number(def.factor) !== Number(p.factor)
      if (differs) {
        const { error } = await sb.from('project_products').upsert(
          { project_id: projectId, name: p.name, my_cost_per_sqm: p.my_cost_per_sqm, factor: p.factor },
          { onConflict: 'project_id,name' })
        if (error) return NextResponse.json({ error: 'Saving a project product price failed: ' + error.message }, { status: 500 })
      } else {
        await sb.from('project_products').delete().eq('project_id', projectId).eq('name', p.name)
      }
    }
  }
  if (motors?.length) {
    const { data: defaults } = await sb.from('motors').select('name, my_cost_per_unit, factor')
    const defMap = new Map((defaults || []).map((d: any) => [d.name, d]))
    for (const m of motors) {
      const def = defMap.get(m.name)
      const differs = !def || Number(def.my_cost_per_unit) !== Number(m.my_cost_per_unit) || Number(def.factor) !== Number(m.factor)
      if (differs) {
        const { error } = await sb.from('project_motors').upsert(
          { project_id: projectId, name: m.name, my_cost_per_unit: m.my_cost_per_unit, factor: m.factor },
          { onConflict: 'project_id,name' })
        if (error) return NextResponse.json({ error: 'Saving a project motor price failed: ' + error.message }, { status: 500 })
      } else {
        await sb.from('project_motors').delete().eq('project_id', projectId).eq('name', m.name)
      }
    }
  }

  return NextResponse.json({ success: true })
}
