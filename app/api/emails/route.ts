import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import { sendEmail } from '@/lib/resend'
import { generateInvoicePdfBase64 } from '@/lib/generateInvoicePdf'

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

  // If this email is attached to a specific invoice, generate a PDF that
  // visually matches the invoice view in the app and attach it — the
  // customer gets the same document you see, not just email text.
  let attachments: { filename: string; content: string }[] | undefined
  if (invoiceId) {
    try {
      const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
      const { data: project } = await supabase.from('projects').select('name, address, customers(name)').eq('id', projectId).single()
      if (invoice && project) {
        const pdfBase64 = await generateInvoicePdfBase64({
          invoiceNumber: invoice.invoice_number,
          invoiceType: invoice.invoice_type,
          pctOfTotal: invoice.pct_of_total,
          totalAmount: Number(invoice.total_amount || 0),
          status: invoice.status,
          projectName: project.name,
          customerName: (project as any).customers?.name || '',
          address: project.address,
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

  // Actually attempt delivery via Resend. A failed send does NOT roll back the
  // log entry above — the record that you tried to send this is kept either
  // way — but the response tells the caller whether it actually went out.
  const sendResult = await sendEmail({ to: toEmail, subject, text: body || '', attachments })

  await supabase.from('activity_log').insert({
    project_id: projectId, actor: auth.actor,
    action: sendResult.ok
      ? `Emailed "${subject}" to ${toEmail}${attachments ? ' (with invoice PDF)' : ''}`
      : `Attempted to email "${subject}" to ${toEmail} — delivery failed: ${sendResult.error}`,
  })

  return NextResponse.json({ ...data, delivered: sendResult.ok, deliveryError: sendResult.ok ? null : sendResult.error })
}
