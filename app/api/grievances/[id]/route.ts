import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { resolutionNote } = await req.json()
  const supabase = createAdminClient()

  const { data: grievance, error: gErr } = await supabase.from('grievances').select('*').eq('id', params.id).single()
  if (gErr || !grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 })

  const note = resolutionNote || 'Resolved'

  const { error } = await supabase.from('grievances').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolution_note: note,
    resolved_by: auth.userId,
  }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // also drop the closing note into the update log, so it shows in the timeline too
  await supabase.from('grievance_updates').insert({
    grievance_id: params.id, note: `[Resolved] ${note}`, created_by: auth.userId,
  })

  await supabase.from('activity_log').insert({
    project_id: grievance.project_id, actor: auth.actor,
    action: `Grievance resolved: "${note.slice(0, 60)}"`,
  })

  const { data: updated, error: reErr } = await supabase
    .from('grievances')
    .select('*, grievance_photos(*), grievance_updates(*)')
    .eq('id', params.id).single()
  if (reErr || !updated) return NextResponse.json({ error: 'Resolved, but could not reload the grievance — refresh the page. ('+(reErr?.message||'no row returned')+')' }, { status: 500 })
  return NextResponse.json(updated)
}

