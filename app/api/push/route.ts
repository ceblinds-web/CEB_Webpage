import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { projectId, config, fees, rows, products, motors, grandTotal } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const sb = createAdminClient()

  // FIX: without onConflict, upsert matches on the primary key (id), which isn't in
  // this payload — every push was inserting a new row instead of updating the
  // existing one. Requires the unique constraint added by migration 008.
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

  // Persist product/motor pricing edits — run in parallel instead of one-at-a-time,
  // and actually check for errors instead of ignoring them.
  if (products?.length) {
    const results = await Promise.all(products.map((p: any) =>
      sb.from('products').update({ my_cost_per_sqm: p.my_cost_per_sqm, factor: p.factor }).eq('id', p.id)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) return NextResponse.json({ error: 'Saving a product price failed: ' + failed.error.message }, { status: 500 })
  }
  if (motors?.length) {
    const results = await Promise.all(motors.map((m: any) =>
      sb.from('motors').update({ my_cost_per_unit: m.my_cost_per_unit, factor: m.factor }).eq('id', m.id)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) return NextResponse.json({ error: 'Saving a motor price failed: ' + failed.error.message }, { status: 500 })
  }

  // Save grand total so invoices can use it
  const now = new Date().toISOString()
  const { data: updatedProject, error: projErr } = await sb.from('projects').update({
    is_pushed: true,
    pushed_at: now,
    grand_total: grandTotal || null,
  }).eq('id', projectId).select().single()
  if (projErr) return NextResponse.json({ error: 'Saving project total failed: ' + projErr.message }, { status: 500 })

  return NextResponse.json({ success: true, project: updatedProject })
}
