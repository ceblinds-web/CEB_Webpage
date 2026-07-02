import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

const SQUARE_PCT = 2.9
const SQUARE_FIXED = 0.30

function squareSurcharge(base: number, method: string): number {
  if (method !== 'square') return 0
  return Math.round((((base + SQUARE_FIXED) / (1 - SQUARE_PCT / 100)) - base) * 100) / 100
}

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('invoices').select('*').eq('project_id', projectId).order('sequence_num')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { projectId, pctOfTotal, method } = await req.json()
  if (!projectId || !pctOfTotal || pctOfTotal <= 0) {
    return NextResponse.json({ error: 'projectId and a positive pctOfTotal are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: project, error: projErr } = await supabase
    .from('projects').select('grand_total, status').eq('id', projectId).single()
  if (projErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.grand_total) return NextResponse.json({ error: 'Push pricing on the project sheet before creating an invoice' }, { status: 400 })

  const { data: existing } = await supabase
    .from('invoices').select('pct_of_total, sequence_num').eq('project_id', projectId).order('sequence_num')
  const billedPct = (existing ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
  const remaining = 100 - billedPct
  if (pctOfTotal > remaining) {
    return NextResponse.json({ error: `% must be ${remaining} or less (remaining unbilled)` }, { status: 400 })
  }

  const seq = (existing?.length ?? 0) + 1
  const invoiceType = seq === 1 ? 'deposit' : (pctOfTotal + billedPct >= 100 ? 'final' : 'progress')
  const base = Number(project.grand_total) * (pctOfTotal / 100)
  const surcharge = squareSurcharge(base, method)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    project_id: projectId,
    status: 'sent',
    total_amount: base + surcharge,
    sequence_num: seq,
    invoice_type: invoiceType,
    pct_of_total: pctOfTotal,
    payment_method: method,
    square_surcharge: surcharge,
    ...(seq === 1 ? { deposit_pct: pctOfTotal, deposit_amount: base + surcharge } : {}),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (project.status === 'confirmed') {
    await supabase.from('projects').update({ status: 'invoiced' }).eq('id', projectId)
  }

  await supabase.from('activity_log').insert({
    project_id: projectId, invoice_id: invoice.id, actor: auth.actor,
    action: `Created ${invoice.invoice_number} (${invoiceType}, ${pctOfTotal}% = $${(base + surcharge).toFixed(2)})`,
  })

  return NextResponse.json(invoice)
}
