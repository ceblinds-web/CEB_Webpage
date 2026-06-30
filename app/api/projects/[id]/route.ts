import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select(`*, customers(*), project_rows(*), project_config(*), project_fees(*)`)
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ error }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  await supabase.from('projects').delete().eq('id', params.id)
  return NextResponse.json({ success: true })
}
