import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: project, error: pErr } = await db
    .from('projects').select('*').eq('id', params.id).single()
  if (pErr || !project) return new Response('Project not found', { status: 404 })

  const { data: rows, error: rErr } = await db
    .from('project_rows').select('*').eq('project_id', params.id)
  if (rErr) return new Response('Error loading rows: ' + rErr.message, { status: 500 })

  // Sort by whichever ordering column exists (schema-agnostic)
  const sortKeys = ['sort_order', 'position', 'row_num', 'sr_no', 'created_at']
  const list = [...(rows || [])]
  const key = list.length ? sortKeys.find(k => k in list[0]) : undefined
  if (key) list.sort((a: any, b: any) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0))

  const wb = XLSX.utils.book_new()

  // Sheet 1: Project Info
  const info = Object.entries(project).map(([k, v]) => ({
    Field: k,
    Value: v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), 'Project Info')

  // Sheet 2: every row, every column
  const clean = list.map((r: any) => {
    const o: any = {}
    for (const [k, v] of Object.entries(r))
      o[k] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v
    return o
  })
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(clean.length ? clean : [{ note: 'No rows in this project' }]),
    'Project Sheet'
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fname = `CEB_${String(project.name || 'Project').replace(/[^a-zA-Z0-9_-]+/g, '_')}.xlsx`
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}
