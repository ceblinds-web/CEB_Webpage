import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

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

  const { projectId, toEmail, subject, body } = await req.json()
  if (!projectId || !toEmail || !subject) {
    return NextResponse.json({ error: 'projectId, toEmail and subject are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('manual_emails').insert({
    project_id: projectId, to_email: toEmail, subject, body: body || '', sent_by: auth.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actual delivery via Resend isn't wired up yet — this only logs the send.
  // Once Resend is connected, call it here before/after this insert.

  await supabase.from('activity_log').insert({
    project_id: projectId, actor: auth.actor, action: `Emailed "${subject}" to ${toEmail}`,
  })

  return NextResponse.json(data)
}
