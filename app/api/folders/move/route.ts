import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  if (!body.project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('projects').update({ folder_id: body.folder_id ?? null }).eq('id', body.project_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
