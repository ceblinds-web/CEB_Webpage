import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

// Saves rows/config/fees as a draft. Does NOT touch is_pushed, pushed_at,
// grand_total, or global product/motor pricing — Push remains the publish step.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { projectId, config, fees, rows } = await req.json()
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

  return NextResponse.json({ success: true })
}
