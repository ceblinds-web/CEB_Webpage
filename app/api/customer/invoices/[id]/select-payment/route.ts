import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getOwnedInvoiceProjectId } from '@/lib/require-customer-project'

const SQUARE_PCT = 2.9
const SQUARE_FIXED = 0.30

function squareSurcharge(base: number, method: string): number {
  if (method !== 'square') return 0
  return Math.round((((base + SQUARE_FIXED) / (1 - SQUARE_PCT / 100)) - base) * 100) / 100
}

// This does NOT process any real payment — no Square/Stripe API call happens
// here. It records which method the customer says they'll use, recalculates
// the surcharge if Square, and leaves a visible note for the admin. Marking
// the invoice actually Paid stays a manual admin action (Invoices tab), same
// as it already was for admin-created invoices.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ownership = await getOwnedInvoiceProjectId(params.id)
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status })

  const { method } = await req.json()
  if (method !== 'cash' && method !== 'square') {
    return NextResponse.json({ error: 'method must be "cash" or "square"' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: invoice, error: invErr } = await admin.from('invoices').select('*').eq('id', params.id).single()
  if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status === 'paid') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 400 })

  // Recompute the amount due for the chosen method — base amount is the
  // pct_of_total portion of the project total, unaffected by payment method;
  // only the surcharge changes.
  const { data: project } = await admin.from('projects').select('grand_total').eq('id', ownership.projectId).single()
  const base = Number(project?.grand_total || 0) * (Number(invoice.pct_of_total || 0) / 100)
  const surcharge = squareSurcharge(base, method)

  const { data: updated, error: updErr } = await admin.from('invoices').update({
    payment_method: method,
    square_surcharge: surcharge,
    total_amount: base + surcharge,
  }).eq('id', params.id).select().single()
  if (updErr || !updated) return NextResponse.json({ error: updErr?.message || 'Could not save selection' }, { status: 500 })

  const fmt = (n: number) => '$' + n.toFixed(2)
  const summary = method === 'cash'
    ? `Customer selected CASH for invoice ${invoice.invoice_number} — amount due ${fmt(base)}. Waiting for you to receive payment and mark it Paid.`
    : `Customer selected SQUARE for invoice ${invoice.invoice_number} — amount due ${fmt(base + surcharge)} (includes ${fmt(surcharge)} card surcharge). Verify the Square payment landed, then mark it Paid.`

  // No real email is sent (Resend is on hold) — this logs into the same Email
  // tab you already use, so it's visible without needing email delivery set up.
  await admin.from('manual_emails').insert({
    project_id: ownership.projectId,
    to_email: `Customer payment selection (${invoice.invoice_number})`,
    subject: `Payment method selected: ${method.toUpperCase()}`,
    body: summary,
    sent_by: null,
  })

  await admin.from('activity_log').insert({
    project_id: ownership.projectId, invoice_id: params.id, actor: 'customer',
    action: summary,
  })

  return NextResponse.json(updated)
}
