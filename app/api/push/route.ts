import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const { projectId, config, fees, rows, products, motors, grandTotal } = await req.json()
  const sb = createAdminClient()

  await sb.from('project_config').upsert({ project_id: projectId, ...config })

  await sb.from('project_fees').delete().eq('project_id', projectId)
  if (fees?.length) await sb.from('project_fees').insert(
    fees.map((f:any,i:number) => ({ ...f, project_id:projectId, sort_order:i }))
  )

  await sb.from('project_rows').delete().eq('project_id', projectId)
  if (rows?.length) await sb.from('project_rows').insert(
    rows.map((r:any,i:number) => ({ ...r, project_id:projectId, sort_order:i }))
  )

  // Persist product/motor pricing edits
  if (products?.length) {
    for (const p of products) {
      await sb.from('products').update({ my_cost_per_sqm:p.my_cost_per_sqm, factor:p.factor }).eq('id', p.id)
    }
  }
  if (motors?.length) {
    for (const m of motors) {
      await sb.from('motors').update({ my_cost_per_unit:m.my_cost_per_unit, factor:m.factor }).eq('id', m.id)
    }
  }

  // Save grand total so invoices can use it
  await sb.from('projects').update({
    is_pushed: true,
    pushed_at: new Date().toISOString(),
    grand_total: grandTotal || null,
  }).eq('id', projectId)

  return NextResponse.json({ success:true })
}
