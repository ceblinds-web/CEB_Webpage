import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

// POST { ordered: string[] } — sets sort_order = array index for each project id
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.ordered) || !body.ordered.length)
    return NextResponse.json({ error: 'ordered[] required' }, { status: 400 })

  const supabase = createAdminClient()
  for (let i = 0; i < body.ordered.length; i++) {
    const { error } = await supabase.from('projects').update({ sort_order: i }).eq('id', body.ordered[i])
    if (error) return NextResponse.json({ error: error.message + ' (did you run migration 018?)' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: body.ordered.length })
}
