import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('projectId')
  const sb = createAdminClient()
  let q = sb.from('grievances').select('*, grievance_photos(*)').order('created_at',{ascending:false})
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data||[])
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.project_id || !body.title) return NextResponse.json({ error:'project_id and title required' }, { status:400 })
  const sb = createAdminClient()
  const { data, error } = await sb.from('grievances').insert({
    project_id: body.project_id, title: body.title, description: body.description||null, status: body.status||'open'
  }).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data, { status:201 })
}
