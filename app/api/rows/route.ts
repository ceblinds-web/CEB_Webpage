import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Save all rows for a project (bulk upsert)
export async function POST(req: Request) {
  const { projectId, rows } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  const supabase = createAdminClient()
  // Delete existing rows then re-insert (simplest approach for now)
  await supabase.from('project_rows').delete().eq('project_id', projectId)
  if (rows?.length) {
    const toInsert = rows.map((r: any, i: number) => ({ ...r, project_id: projectId, sort_order: i }))
    const { error } = await supabase.from('project_rows').insert(toInsert)
    if (error) return NextResponse.json({ error }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
