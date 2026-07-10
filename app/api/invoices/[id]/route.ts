import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('invoices').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('invoices').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  let actionLabel = ''

  switch (body.action) {
    case 'mark_paid':
      update.status = 'paid'
      update.fully_paid_at = new Date().toISOString()
      actionLabel = 'marked PAID'
      break
    case 'unmark_paid':
      update.status = 'sent'
      update.fully_paid_at = null
      actionLabel = 'marked UNPAID'
      break
    case 'void':
      if (existing.status === 'paid') {
        return NextResponse.json({ error: 'A paid invoice cannot be voided — this would hide real payment history. Contact support if this needs correcting.' }, { status: 400 })
      }
      update.status = 'void'
      actionLabel = 'voided'
      break
    case 'unvoid':
      update.status = 'sent'
      actionLabel = 'un-voided (restored)'
      break
    default:
      // Fallback for any direct field edits (notes, due_date, payment_method)
      // that don't go through the action pattern above.
      if (body.notes !== undefined) update.notes = body.notes
      if (body.due_date !== undefined) update.due_date = body.due_date
      if (body.payment_method !== undefined) update.payment_method = body.payment_method
      actionLabel = 'updated'
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('invoices').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    project_id: existing.project_id, invoice_id: params.id, actor: auth.actor,
    action: `Invoice ${existing.invoice_number} ${actionLabel}`,
    old_value: existing.status, new_value: data.status,
  })

  return NextResponse.json(data)
}

// Deletion is only allowed for an invoice with NO payment history — deleting
// one that's already been (even partially) paid would silently lose real
// money records. For anything with payments, use PATCH { status: 'void' }
// instead, which keeps the record for audit purposes but excludes it from
// balance-due totals.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('invoices').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: payments } = await supabase.from('payments').select('id').eq('invoice_id', params.id).limit(1)
  if (payments && payments.length > 0) {
    return NextResponse.json({ error: 'This invoice has payment history and cannot be deleted — void it instead to preserve the record.' }, { status: 400 })
  }

  const { error } = await supabase.from('invoices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    project_id: existing.project_id, actor: auth.actor,
    action: `Deleted invoice ${existing.invoice_number} (no payment history)`,
  })

  return NextResponse.json({ success: true })
}
