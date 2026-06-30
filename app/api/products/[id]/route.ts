import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
export async function PATCH(req: Request, { params }: { params:{id:string} }) {
  const { data, error } = await createAdminClient().from('products').update(await req.json()).eq('id',params.id).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data)
}
export async function DELETE(_: Request, { params }: { params:{id:string} }) {
  // Soft delete - keep historical pricing data intact for past projects
  await createAdminClient().from('products').update({ is_active:false }).eq('id',params.id)
  return NextResponse.json({ success:true })
}
