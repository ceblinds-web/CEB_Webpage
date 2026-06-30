import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function PATCH(req: Request, { params }: { params:{id:string} }) {
  const { data, error } = await createAdminClient().from('invoices').update(await req.json()).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data)
}
