import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
export async function PATCH(req: Request, { params }: { params:{id:string} }) {
  const { data, error } = await createAdminClient().from('motors').update(await req.json()).eq('id',params.id).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data)
}
export async function DELETE(_: Request, { params }: { params:{id:string} }) {
  await createAdminClient().from('motors').update({ is_active:false }).eq('id',params.id)
  return NextResponse.json({ success:true })
}
