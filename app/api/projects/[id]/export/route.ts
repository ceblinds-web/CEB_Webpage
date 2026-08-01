import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()

  const { data: project, error: pErr } = await supabase
    .from('projects').select('*').eq('id', params.id).single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Load line items — try project_rows first, fall back to rows
  let rows: any[] | null = null
  let lastErr = ''
  for (const table of ['project_rows', 'rows']) {
    const { data, error } = await supabase.from(table).select('*').eq('project_id', params.id)
    if (!error) { rows = data || []; break }
    lastErr = `${table}: ${error.message}`
  }
  if (rows === null)
    return NextResponse.json({ error: 'Could not load project rows — ' + lastErr }, { status: 500 })

  // Sort by whichever ordering column exists
  const sortKeys = ['sort_order', 'position', 'row_num', 'sr_no', 'created_at']
  const key = rows.length ? sortKeys.find(k => k in rows![0]) : undefined
  if (key) rows.sort((a: any, b: any) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0))

  const wb = XLSX.utils.book_new()

  const info = Object.entries(project).map(([k, v]) => ({
    Field: k,
    Value: v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), 'Project Info')

  const clean = rows.map((r: any) => {
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
