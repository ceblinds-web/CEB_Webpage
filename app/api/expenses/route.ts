import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { category, description, cost, expense_date, project_id } = body
  if (!description || !cost) return NextResponse.json({ error: 'description and cost are required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('expenses').insert({
    category: category || 'MISC_OVERHEAD', description, cost,
    expense_date: expense_date || new Date().toISOString().slice(0, 10),
    project_id: project_id || null, created_by: auth.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
