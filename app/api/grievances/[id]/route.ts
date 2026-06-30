import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function PATCH(req: Request, { params }: { params:{id:string} }) {
  const body = await req.json()
  const sb = createAdminClient()
  if (body.status === 'resolved') body.resolved_at = new Date().toISOString()
  const { data, error } = await sb.from('grievances').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params:{id:string} }) {
  await createAdminClient().from('grievances').delete().eq('id', params.id)
  return NextResponse.json({ success:true })
}
