import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { note } = await req.json()
  if (!note || !note.trim()) return NextResponse.json({ error: 'Note is required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: grievance, error: gErr } = await supabase.from('grievances').select('*').eq('id', params.id).single()
  if (gErr || !grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 })

  const { error: insErr } = await supabase.from('grievance_updates').insert({
    grievance_id: params.id, note, created_by: auth.userId,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // first update on an "open" grievance moves it to "in_progress"
  if (grievance.status === 'open') {
    await supabase.from('grievances').update({ status: 'in_progress' }).eq('id', params.id)
  }

  await supabase.from('activity_log').insert({
    project_id: grievance.project_id, actor: auth.actor,
    action: `Grievance update: "${note.slice(0, 60)}"`,
  })

  const { data: updated, error: reErr } = await supabase
    .from('grievances')
    .select('*, grievance_photos(*), grievance_updates(*)')
    .eq('id', params.id).single()
  if (reErr || !updated) return NextResponse.json({ error: 'Update logged, but could not reload the grievance — refresh the page. ('+(reErr?.message||'no row returned')+')' }, { status: 500 })
  return NextResponse.json(updated)
}
