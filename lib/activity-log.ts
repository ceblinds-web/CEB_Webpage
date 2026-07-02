// lib/activity-log.ts
// activity_log has RLS enabled with NO policies (see migration 003b) — this is
// intentional, so it can never be read/written directly from the browser, even
// by an authenticated admin. Only the service-role client can touch it, so
// every write MUST go through createAdminClient(), never the regular one.

import { createAdminClient } from '@/lib/supabase-server'

export async function logActivity(params: {
  projectId?: string | null
  invoiceId?: string | null
  actor: string
  action: string
  oldValue?: string | null
  newValue?: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('activity_log').insert({
    project_id: params.projectId ?? null,
    invoice_id: params.invoiceId ?? null,
    actor: params.actor,
    action: params.action,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  })
  // Never let an activity-log failure block the actual business action —
  // just log it server-side so it doesn't get silently lost either.
  if (error) console.error('activity_log insert failed:', error.message)
}
