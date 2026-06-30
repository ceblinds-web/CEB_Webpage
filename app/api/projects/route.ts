import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const supabase = createAdminClient()
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('projects').insert(body).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  await supabase.from('project_config').insert({ project_id: data.id })
  return NextResponse.json(data, { status: 201 })
}
