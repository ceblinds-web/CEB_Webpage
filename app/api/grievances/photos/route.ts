import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  const grievanceId = form.get('grievanceId') as string
  const caption = (form.get('caption') as string) || null
  if (!file || !grievanceId) return NextResponse.json({ error:'file and grievanceId required' }, { status:400 })

  const sb = createAdminClient()
  const ext = file.name.split('.').pop()
  const path = `${grievanceId}/${Date.now()}.${ext}`
  const buf = await file.arrayBuffer()

  const { error: upErr } = await sb.storage.from('grievance-photos').upload(path, buf, { contentType: file.type })
  if (upErr) return NextResponse.json({ error: upErr }, { status:500 })

  const { data: urlData } = sb.storage.from('grievance-photos').getPublicUrl(path)
  const { data, error } = await sb.from('grievance_photos').insert({
    grievance_id: grievanceId, photo_url: urlData.publicUrl, caption
  }).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data, { status:201 })
}
