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
    .from('grievances')
    .select('*, grievance_photos(*), grievance_updates(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const g of data ?? []) {
    if (g.grievance_updates) g.grievance_updates.sort((a: any, b: any) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const formData = await req.formData()
  const projectId = formData.get('projectId') as string
  const title = (formData.get('title') as string || '').trim()
  const description = formData.get('description') as string || ''
  const file = formData.get('file') as File | null

  if (!projectId || !title) return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: grievance, error } = await supabase.from('grievances').insert({
    project_id: projectId, title, description, status: 'open', created_by: auth.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let photoUrl: string | null = null
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    const path = `${projectId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('grievance-photos').upload(path, file)
    if (!upErr) {
      const { data: pub } = supabase.storage.from('grievance-photos').getPublicUrl(path)
      photoUrl = pub.publicUrl
      await supabase.from('grievance_photos').insert({ grievance_id: grievance.id, photo_url: photoUrl })
    }
  }

  await supabase.from('activity_log').insert({
    project_id: projectId, actor: auth.actor,
    action: `Grievance logged: "${title.slice(0, 60)}"${photoUrl ? ' (1 photo)' : ''}`,
  })

  const { data: full, error: reErr } = await supabase.from('grievances').select('*, grievance_photos(*), grievance_updates(*)').eq('id', grievance.id).single()
  if (reErr || !full) return NextResponse.json({ error: 'Logged, but could not reload — refresh the page.' }, { status: 500 })
  return NextResponse.json(full)
}
