import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

const SQUARE_PCT = 2.9
const SQUARE_FIXED = 0.30

function squareSurcharge(base: number, method: string): number {
  if (method !== 'square') return 0
  return Math.round((((base + SQUARE_FIXED) / (1 - SQUARE_PCT / 100)) - base) * 100) / 100
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = createAdminClient()
  const invoiceId = params.id

  const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // ── EDIT (% / payment method) — only while unpaid ──
  if (body.action === 'edit') {
    if (invoice.status === 'paid') return NextResponse.json({ error: 'Paid invoices cannot be edited' }, { status: 400 })

    const { data: project } = await supabase.from('projects').select('grand_total').eq('id', invoice.project_id).single()
    if (!project?.grand_total) return NextResponse.json({ error: 'Project has no grand total' }, { status: 400 })

    const { data: others } = await supabase
      .from('invoices').select('pct_of_total').eq('project_id', invoice.project_id).neq('id', invoiceId)
    const othersPct = (others ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
    const pctOfTotal = Number(body.pctOfTotal)
    if (!pctOfTotal || pctOfTotal <= 0 || pctOfTotal + othersPct > 100) {
      return NextResponse.json({ error: `% must be between 1 and ${100 - othersPct}` }, { status: 400 })
    }

    const method = body.method === 'square' ? 'square' : 'cash'
    const base = Number(project.grand_total) * (pctOfTotal / 100)
    const surcharge = squareSurcharge(base, method)
    const invoiceType = invoice.sequence_num === 1 ? 'deposit' : (pctOfTotal + othersPct >= 100 ? 'final' : 'progress')

    const { error } = await supabase.from('invoices').update({
      pct_of_total: pctOfTotal, payment_method: method, square_surcharge: surcharge,
      total_amount: base + surcharge, invoice_type: invoiceType,
    }).eq('id', invoiceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('activity_log').insert({
      project_id: invoice.project_id, invoice_id: invoiceId, actor: auth.actor,
      action: `Edited ${invoice.invoice_number} — now ${pctOfTotal}% / ${method} = $${(base + surcharge).toFixed(2)}`,
      old_value: `${invoice.pct_of_total}% / ${invoice.payment_method}`,
      new_value: `${pctOfTotal}% / ${method}`,
    })

    const { data: updated, error: reErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (reErr || !updated) return NextResponse.json({ error: 'Saved, but could not reload the invoice — refresh the page. ('+(reErr?.message||'no row returned')+')' }, { status: 500 })
    return NextResponse.json(updated)
  }

  // ── MARK PAID ──
  if (body.action === 'mark_paid') {
    if (invoice.status === 'paid') return NextResponse.json(invoice)
    const now = new Date().toISOString()

    const { error: payErr } = await supabase.from('payments').insert({
      invoice_id: invoiceId, amount: invoice.total_amount, payment_method: invoice.payment_method ?? 'cash', paid_at: now,
    })
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

    // THIS invoice was paid in full, at its own amount — its own status is simply 'paid',
    // independent of whether other invoices in the chain are also settled.
    const { error: updErr } = await supabase.from('invoices').update({
      status: 'paid', fully_paid_at: now,
    }).eq('id', invoiceId)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Separately: is the WHOLE PROJECT's invoice chain now fully collected? This only
    // affects the project's own status/flags, never this invoice's own status field.
    const { data: allForProject } = await supabase
      .from('invoices').select('id, pct_of_total, status').eq('project_id', invoice.project_id)
    const allPct = (allForProject ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
    const allPaid = (allForProject ?? []).every((i: { id: string; status: string | null }) => i.id === invoiceId || i.status === 'paid')
    const fullyPaid = allPaid && allPct >= 99.5

    const { data: project } = await supabase.from('projects').select('status').eq('id', invoice.project_id).single()
    const projectUpdate: Record<string, unknown> = {}
    if (invoice.sequence_num === 1) { projectUpdate.deposit_paid = true; projectUpdate.deposit_paid_at = now }
    if (fullyPaid) {
      projectUpdate.full_payment_paid = true; projectUpdate.full_payment_paid_at = now; projectUpdate.status = 'completed'
    } else if (project?.status === 'confirmed') {
      projectUpdate.status = 'invoiced'
    }
    if (Object.keys(projectUpdate).length) {
      await supabase.from('projects').update(projectUpdate).eq('id', invoice.project_id)
    }

    await supabase.from('activity_log').insert({
      project_id: invoice.project_id, invoice_id: invoiceId, actor: auth.actor,
      action: `${invoice.invoice_number} marked PAID${fullyPaid ? ' — full payment collected' : ''}`,
    })

    const { data: updated, error: reErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (reErr || !updated) return NextResponse.json({ error: 'Marked paid, but could not reload the invoice — refresh the page. ('+(reErr?.message||'no row returned')+')' }, { status: 500 })
    return NextResponse.json(updated)
  }

  // ── UNMARK PAID ──
  if (body.action === 'unmark_paid') {
    await supabase.from('payments').delete().eq('invoice_id', invoiceId)
    await supabase.from('invoices').update({ status: 'sent', fully_paid_at: null }).eq('id', invoiceId)

    await supabase.from('activity_log').insert({
      project_id: invoice.project_id, invoice_id: invoiceId, actor: auth.actor,
      action: `${invoice.invoice_number} reverted to unpaid`,
    })

    const { data: updated, error: reErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (reErr || !updated) return NextResponse.json({ error: 'Reverted, but could not reload the invoice — refresh the page. ('+(reErr?.message||'no row returned')+')' }, { status: 500 })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
