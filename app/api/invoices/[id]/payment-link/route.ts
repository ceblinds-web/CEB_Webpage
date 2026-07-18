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
  // same link normally stays valid. BUT: if the cached link is from a
  // different Square environment than the one currently configured (e.g.
  // it was generated back when SQUARE_ENVIRONMENT was "sandbox" and you've
  // since switched to "production"), that cached link is stale — serving
  // it would silently keep sending customers to the wrong environment
  // forever, since this check runs before Square is ever called again.
  const currentEnv = process.env.SQUARE_ENVIRONMENT || 'sandbox'
  const cachedLinkIsSandbox = invoice.square_payment_link?.includes('sandbox.square.link')
  const cachedLinkMatchesCurrentEnv = invoice.square_payment_link
    ? (currentEnv === 'production' ? !cachedLinkIsSandbox : cachedLinkIsSandbox)
    : false

  if (invoice.square_payment_link && cachedLinkMatchesCurrentEnv) {
    return NextResponse.json({ url: invoice.square_payment_link, cached: true })
  }

  // Card payments carry a 3.5% surcharge, disclosed to the customer in the
  // invoice email ("cash: no fee, card: +3.5%") — applying it here too so
  // the amount actually charged always matches what was promised, rather
  // than the business quietly absorbing the processing fee.
  const CARD_SURCHARGE_RATE = 0.035
  const surchargedAmount = Number(invoice.total_amount || 0) * (1 + CARD_SURCHARGE_RATE)

  const result = await createSquarePaymentLink({
    invoiceNumber: invoice.invoice_number,
    amount: surchargedAmount,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  await supabase.from('invoices').update({ square_payment_link: result.url }).eq('id', params.id)
  await supabase.from('activity_log').insert({
    project_id: invoice.project_id, invoice_id: params.id, actor: auth.actor,
    action: `Generated Square payment link for invoice ${invoice.invoice_number} (${result.environment})`,
  })

  return NextResponse.json({ url: result.url, cached: false })
}
