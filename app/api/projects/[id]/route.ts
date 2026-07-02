import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  // Invoices/grievances/emails are deliberately NOT joined here anymore — this route
  // gates the initial page render, and those three were making an already-heavy
  // 4-table join into a 7-table one. They're fetched separately, in parallel, right
  // after this resolves (see GET /api/invoices, /api/grievances, /api/emails with
  // ?projectId=), so the Sheet tab can render as soon as the core data is back
  // instead of waiting on grievance photos and email bodies it doesn't need yet.
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      customers(*),
      project_rows(*),
      project_config(*),
      project_fees(*)
    `)
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ error }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  await supabase.from('projects').delete().eq('id', params.id)
  return NextResponse.json({ success: true })
}
