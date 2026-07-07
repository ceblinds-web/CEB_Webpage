import { createClient } from '@/lib/supabase-server'

// Used by customer-facing API routes. Deliberately does NOT use the service-role
// client to check ownership — it queries through the RLS-respecting client, the
// same one that already successfully scopes /customer/project/[id] to only the
// signed-in customer's own projects. If RLS says no, this returns null, and the
// caller should treat that as "not found / not yours" rather than a hard error,
// so we don't leak whether a project ID exists at all.
export async function getOwnedProjectId(projectId: string): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Not signed in' }

  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
  if (!project) return { ok: false, status: 404, error: 'Project not found' }

  return { ok: true, userId: user.id }
}

// For row-level writes: confirm the row's parent project is owned by the current
// user, same pattern.
export async function getOwnedRowProjectId(rowId: string): Promise<{ ok: true; userId: string; projectId: string } | { ok: false; status: number; error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Not signed in' }

  const { data: row } = await supabase.from('project_rows').select('id, project_id').eq('id', rowId).single()
  if (!row) return { ok: false, status: 404, error: 'Row not found' }

  return { ok: true, userId: user.id, projectId: row.project_id }
}

// For invoice writes: confirm the invoice's parent project is owned by the
// current user, same pattern.
export async function getOwnedInvoiceProjectId(invoiceId: string): Promise<{ ok: true; userId: string; projectId: string } | { ok: false; status: number; error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Not signed in' }

  const { data: invoice } = await supabase.from('invoices').select('id, project_id').eq('id', invoiceId).single()
  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' }

  return { ok: true, userId: user.id, projectId: invoice.project_id }
}
