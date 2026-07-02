import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customers').select('*, projects(id, name, status)').order('created_at')
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  if (!body.name || !body.email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('customers').insert(body).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
