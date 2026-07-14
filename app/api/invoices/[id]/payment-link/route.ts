import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import { createSquarePaymentLink } from '@/lib/square'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', params.id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Reuse an existing link rather than generating a new checkout page every
  // time — the amount due doesn't change once an invoice exists, so the
  // same link stays valid.
  if (invoice.square_payment_link) {
    return NextResponse.json({ url: invoice.square_payment_link, cached: true })
  }

  const result = await createSquarePaymentLink({
    invoiceNumber: invoice.invoice_number,
    amount: Number(invoice.total_amount || 0),
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  await supabase.from('invoices').update({ square_payment_link: result.url }).eq('id', params.id)
  await supabase.from('activity_log').insert({
    project_id: invoice.project_id, invoice_id: params.id, actor: auth.actor,
    action: `Generated Square payment link for invoice ${invoice.invoice_number} (${result.environment})`,
  })

  return NextResponse.json({ url: result.url, cached: false })
}
