import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('projectId')
  const sb = createAdminClient()
  let q = sb.from('invoices')
    .select('*, projects(id, name, grand_total, deposit_pct, customers(name,email))')
    .order('created_at',{ascending:false})
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data||[])
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.project_id || body.total_amount === undefined) {
    return NextResponse.json({ error:'project_id and total_amount required' }, { status:400 })
  }
  const sb = createAdminClient()
  const depositAmt = body.total_amount * ((body.deposit_pct||30)/100)
  const { data, error } = await sb.from('invoices').insert({
    project_id: body.project_id,
    total_amount: body.total_amount,
    deposit_pct: body.deposit_pct || 30,
    deposit_amount: depositAmt,
    status: 'draft',
  }).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  // Also mark project status as invoiced
  await sb.from('projects').update({ status:'invoiced' }).eq('id', body.project_id)
  return NextResponse.json(data, { status:201 })
}
