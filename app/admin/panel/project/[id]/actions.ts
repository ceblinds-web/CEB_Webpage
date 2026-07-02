// app/admin/panel/project/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { logActivity } from '@/lib/activity-log'

const SQUARE_PCT = 2.9
const SQUARE_FIXED = 0.30

function squareSurcharge(base: number, method: string): number {
  if (method !== 'square') return 0
  return Math.round((((base + SQUARE_FIXED) / (1 - SQUARE_PCT / 100)) - base) * 100) / 100
}

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data: profile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')
  return { supabase, actor: profile.email ?? profile.full_name ?? user.id }
}

// ─────────────────────────── INVOICES ───────────────────────────

export async function createInvoice(projectId: string, pctOfTotal: number, method: 'cash' | 'square') {
  const { supabase, actor } = await requireAdmin()

  const { data: project, error: projErr } = await supabase
    .from('projects').select('grand_total, status').eq('id', projectId).single()
  if (projErr || !project) throw new Error('Project not found')
  if (!project.grand_total) throw new Error('Push pricing on the project sheet before creating an invoice')

  const { data: existing } = await supabase
    .from('invoices').select('pct_of_total, sequence_num').eq('project_id', projectId).order('sequence_num')
  const billedPct = (existing ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
  const remaining = 100 - billedPct
  if (pctOfTotal <= 0 || pctOfTotal > remaining) throw new Error(`% must be between 1 and ${remaining} (remaining unbilled)`)

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
    // keep legacy deposit_* fields fed for the first invoice, for anything still reading them
    ...(seq === 1 ? { deposit_pct: pctOfTotal, deposit_amount: base + surcharge } : {}),
  }).select().single()
  if (error) throw new Error(error.message)

  if (project.status === 'confirmed') {
    await supabase.from('projects').update({ status: 'invoiced' }).eq('id', projectId)
  }

  await logActivity({
    projectId, invoiceId: invoice.id, actor,
    action: `Created ${invoice.invoice_number} (${invoiceType}, ${pctOfTotal}% = $${(base + surcharge).toFixed(2)})`,
  })

  revalidatePath(`/admin/panel/project/${projectId}`)
  return invoice
}

export async function updateInvoice(invoiceId: string, pctOfTotal: number, method: 'cash' | 'square') {
  const { supabase, actor } = await requireAdmin()

  const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (invErr || !invoice) throw new Error('Invoice not found')
  if (invoice.status === 'paid') throw new Error('Paid invoices cannot be edited')

  const { data: project } = await supabase.from('projects').select('grand_total').eq('id', invoice.project_id).single()
  if (!project?.grand_total) throw new Error('Project has no grand total')

  const { data: others } = await supabase
    .from('invoices').select('pct_of_total').eq('project_id', invoice.project_id).neq('id', invoiceId)
  const othersPct = (others ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
  if (pctOfTotal <= 0 || pctOfTotal + othersPct > 100) throw new Error(`% must be between 1 and ${100 - othersPct}`)

  const base = Number(project.grand_total) * (pctOfTotal / 100)
  const surcharge = squareSurcharge(base, method)
  const invoiceType = invoice.sequence_num === 1 ? 'deposit' : (pctOfTotal + othersPct >= 100 ? 'final' : 'progress')

  const { error } = await supabase.from('invoices').update({
    pct_of_total: pctOfTotal,
    payment_method: method,
    square_surcharge: surcharge,
    total_amount: base + surcharge,
    invoice_type: invoiceType,
  }).eq('id', invoiceId)
  if (error) throw new Error(error.message)

  await logActivity({
    projectId: invoice.project_id, invoiceId, actor,
    action: `Edited ${invoice.invoice_number} — now ${pctOfTotal}% / ${method} = $${(base + surcharge).toFixed(2)}`,
    oldValue: `${invoice.pct_of_total}% / ${invoice.payment_method}`,
    newValue: `${pctOfTotal}% / ${method}`,
  })

  revalidatePath(`/admin/panel/project/${invoice.project_id}`)
}

export async function markInvoicePaid(invoiceId: string) {
  const { supabase, actor } = await requireAdmin()

  const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (invErr || !invoice) throw new Error('Invoice not found')
  if (invoice.status === 'paid') return

  const now = new Date().toISOString()

  const { error: payErr } = await supabase.from('payments').insert({
    invoice_id: invoiceId,
    amount: invoice.total_amount,
    payment_method: invoice.payment_method ?? 'cash',
    paid_at: now,
  })
  if (payErr) throw new Error(payErr.message)

  const { data: allForProject } = await supabase
    .from('invoices').select('id, pct_of_total, status').eq('project_id', invoice.project_id)
  const allPct = (allForProject ?? []).reduce((s: number, i: { pct_of_total: number | null }) => s + Number(i.pct_of_total ?? 0), 0)
  const allOthersPaid = (allForProject ?? []).every((i: { id: string; status: string | null }) => i.id === invoiceId || i.status === 'paid')
  const fullyPaid = allOthersPaid && allPct >= 99.5

  const { error } = await supabase.from('invoices').update({
    status: fullyPaid ? 'paid' : 'partially_paid',
    fully_paid_at: fullyPaid ? now : null,
  }).eq('id', invoiceId)
  if (error) throw new Error(error.message)

  const { data: project } = await supabase.from('projects').select('status').eq('id', invoice.project_id).single()
  const projectUpdate: Record<string, unknown> = {}
  if (invoice.sequence_num === 1) { projectUpdate.deposit_paid = true; projectUpdate.deposit_paid_at = now }
  if (fullyPaid) {
    projectUpdate.full_payment_paid = true
    projectUpdate.full_payment_paid_at = now
    projectUpdate.status = 'completed'
  } else if (project?.status === 'confirmed') {
    projectUpdate.status = 'invoiced'
  }
  if (Object.keys(projectUpdate).length) {
    await supabase.from('projects').update(projectUpdate).eq('id', invoice.project_id)
  }

  await logActivity({
    projectId: invoice.project_id, invoiceId, actor,
    action: `${invoice.invoice_number} marked PAID${fullyPaid ? ' — full payment collected' : ''}`,
  })

  revalidatePath(`/admin/panel/project/${invoice.project_id}`)
}

export async function unmarkInvoicePaid(invoiceId: string) {
  const { supabase, actor } = await requireAdmin()
  const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (invErr || !invoice) throw new Error('Invoice not found')

  await supabase.from('payments').delete().eq('invoice_id', invoiceId)
  await supabase.from('invoices').update({ status: 'sent', fully_paid_at: null }).eq('id', invoiceId)

  await logActivity({
    projectId: invoice.project_id, invoiceId, actor,
    action: `${invoice.invoice_number} reverted to unpaid`,
  })

  revalidatePath(`/admin/panel/project/${invoice.project_id}`)
}

// ─────────────────────────── GRIEVANCES ───────────────────────────

export async function createGrievance(projectId: string, title: string, description: string, photoUrls: string[]) {
  const { supabase, actor } = await requireAdmin()
  if (!title.trim()) throw new Error('Title required')

  const { data: { user } } = await supabase.auth.getUser()
  const { data: grievance, error } = await supabase.from('grievances').insert({
    project_id: projectId, title, description, status: 'open', created_by: user?.id ?? null,
  }).select().single()
  if (error) throw new Error(error.message)

  if (photoUrls.length) {
    await supabase.from('grievance_photos').insert(
      photoUrls.map(url => ({ grievance_id: grievance.id, photo_url: url }))
    )
  }

  await logActivity({
    projectId, actor,
    action: `Grievance logged: "${title.slice(0, 60)}"${photoUrls.length ? ` (${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''})` : ''}`,
  })

  revalidatePath(`/admin/panel/project/${projectId}`)
  return grievance
}

export async function resolveGrievance(grievanceId: string, resolutionNote: string) {
  const { supabase, actor } = await requireAdmin()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: grievance, error: gErr } = await supabase.from('grievances').select('*').eq('id', grievanceId).single()
  if (gErr || !grievance) throw new Error('Grievance not found')

  const { error } = await supabase.from('grievances').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolution_note: resolutionNote || 'Resolved',
    resolved_by: user?.id ?? null,
  }).eq('id', grievanceId)
  if (error) throw new Error(error.message)

  await logActivity({
    projectId: grievance.project_id, actor,
    action: `Grievance resolved: "${(resolutionNote || 'Resolved').slice(0, 60)}"`,
  })

  revalidatePath(`/admin/panel/project/${grievance.project_id}`)
}

// Uploads a photo to the `grievance-photos` Storage bucket and returns its public URL.
// NOTE: this bucket must exist in Supabase Storage with an admin-write / public-read
// policy — it isn't created by any migration, since Storage buckets aren't SQL.
export async function uploadGrievancePhoto(projectId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')

  const ext = file.name.split('.').pop()
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('grievance-photos').upload(path, file)
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('grievance-photos').getPublicUrl(path)
  return data.publicUrl
}

// ─────────────────────────── EMAIL ───────────────────────────

export async function sendManualEmail(projectId: string, toEmail: string, subject: string, body: string) {
  const { supabase, actor } = await requireAdmin()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('manual_emails').insert({
    project_id: projectId, to_email: toEmail, subject, body, sent_by: user?.id ?? null,
  })
  if (error) throw new Error(error.message)

  // Actual delivery via Resend isn't wired up yet (per project status) — this only
  // logs the send. Once Resend is connected, call it here before/after this insert.

  await logActivity({ projectId, actor, action: `Emailed "${subject}" to ${toEmail}` })
  revalidatePath(`/admin/panel/project/${projectId}`)
}
