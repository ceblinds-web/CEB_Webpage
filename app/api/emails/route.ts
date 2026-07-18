import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import { sendEmail } from '@/lib/resend'
import { generateInvoicePdfBase64 } from '@/lib/generateInvoicePdf'

const CONV = 0.00064516
// Same formula used everywhere else in the app — always rounds sq.m UP,
// minimum 1 sq.m billable.
function sqm(w: any, h: any) {
  const s = parseFloat(w || 0) * parseFloat(h || 0) * CONV
  return s > 0 ? Math.max(1, Math.ceil(s * 100) / 100) : 0
}

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('manual_emails').select('*').eq('project_id', projectId).order('sent_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { projectId, toEmail, subject, body, invoiceId } = await req.json()
  if (!projectId || !toEmail || !subject) {
    return NextResponse.json({ error: 'projectId, toEmail and subject are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('manual_emails').insert({
    project_id: projectId, to_email: toEmail, subject, body: body || '', sent_by: auth.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If this email is attached to a specific invoice, build a PDF that
  // matches the actual Invoices tab in the app — real line items and the
  // same full pricing breakdown, not just a one-line summary.
  let attachments: { filename: string; content: string }[] | undefined
  if (invoiceId) {
    try {
      const [{ data: invoice }, { data: project }, { data: rows }, { data: config }, { data: fees }, { data: products }, { data: motors }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', invoiceId).single(),
        supabase.from('projects').select('name, address, customers(name)').eq('id', projectId).single(),
        supabase.from('project_rows').select('*').eq('project_id', projectId).eq('is_section', false),
        supabase.from('project_config').select('*').eq('project_id', projectId).single(),
        supabase.from('project_fees').select('*').eq('project_id', projectId),
        supabase.from('products').select('name, my_cost_per_sqm, factor').eq('is_active', true),
        supabase.from('motors').select('name, my_cost_per_unit, factor').eq('is_active', true),
      ])

      if (invoice && project) {
        const getProd = (name: string) => (products || []).find((p: any) => p.name === name) || { my_cost_per_sqm: 0, factor: 0 }
        const getMotor = (name: string) => (motors || []).find((m: any) => m.name === name) || { my_cost_per_unit: 0, factor: 0 }
        // Rows toggled "off" (priced=false, the eye icon) are excluded here
        // too — same rule as everywhere else: not counted, not shown.
        const pricedRows = (rows || []).filter((r: any) => r.priced !== false)

        const lineItems = pricedRows.map((r: any) => {
          const p = getProd(r.blind_type)
          const m = getMotor(r.control)
          const area = sqm(r.width_in, r.height_in)
          const qty = r.qty || 1
          const blindsAmt = Math.round(area * p.my_cost_per_sqm * p.factor * 100) / 100 * qty
          const motorAmt = m.my_cost_per_unit * m.factor * qty
          return { location: r.location, blindType: r.blind_type, control: r.control, fabric: r.fabric, qty, amount: blindsAmt + motorAmt }
        })

        const totB = lineItems.reduce((s, i) => s + i.amount, 0)
        const discountPct = Number(config?.discount_pct || 0)
        const subtotal = totB * (1 - discountPct / 100)
        const discountAmount = totB * (discountPct / 100)
        const taxPct = Number(config?.tax_pct || 0)
        const taxAmount = subtotal * (taxPct / 100)
        const shippingAmount = subtotal * (Number(config?.shipping_pct || 0) / 100)
        const installationAmount = Number(config?.installation || 0)
        const extraFees = (fees || []).map((f: any) => ({
          label: f.label, amount: f.fee_type === 'pct' ? subtotal * (Number(f.value || 0) / 100) : Number(f.value || 0),
        }))
        const extraTotal = extraFees.reduce((s, f) => s + f.amount, 0)
        const grandTotal = subtotal + taxAmount + shippingAmount + installationAmount + extraTotal

        const pdfBase64 = await generateInvoicePdfBase64({
          invoiceNumber: invoice.invoice_number,
          invoiceType: invoice.invoice_type,
          pctOfTotal: invoice.pct_of_total,
          totalAmount: Number(invoice.total_amount || 0),
          status: invoice.status,
          projectName: project.name,
          customerName: (project as any).customers?.name || '',
          address: project.address,
          lineItems, subtotal, discountPct, discountAmount, taxPct, taxAmount, shippingAmount, installationAmount, extraFees, grandTotal,
        })
        attachments = [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBase64 }]
      }
    } catch (err) {
      // A PDF generation failure shouldn't block the email entirely — it
      // just goes out without the attachment, and the response below still
      // reports success/failure of the send itself accurately.
      console.error('[emails] PDF generation failed:', err)
    }
  }

  const sendResult = await sendEmail({ to: toEmail, subject, text: body || '', attachments })

  await supabase.from('activity_log').insert({
    project_id: projectId, actor: auth.actor,
    action: sendResult.ok
      ? `Emailed "${subject}" to ${toEmail}${attachments ? ' (with invoice PDF)' : ''}`
      : `Attempted to email "${subject}" to ${toEmail} — delivery failed: ${sendResult.error}`,
  })

  return NextResponse.json({ ...data, delivered: sendResult.ok, deliveryError: sendResult.ok ? null : sendResult.error })
}
