import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  const { data: orig, error: origErr } = await supabase
    .from('projects').select('*').eq('id', params.id).single()
  if (origErr || !orig) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Copy every field, then reset identity/status/payment flags
  const copy: any = { ...orig }
  delete copy.id
  delete copy.created_at
  delete copy.updated_at
  copy.name = body.name?.trim() || `${orig.name} (Copy)`
  copy.status = 'draft'
  const resets: Record<string, any> = {
    deposit_paid: false, deposit_paid_at: null,
    full_payment_paid: false, full_payment_paid_at: null,
  }
  for (const [k, v] of Object.entries(resets)) if (k in orig) copy[k] = v

  const { data: newProj, error: insErr } = await supabase
    .from('projects').insert(copy).select().single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Copy all sheet rows (try project_rows, fall back to rows)
  let copied = 0
  for (const table of ['project_rows', 'rows']) {
    const { data: rws, error: rErr } = await supabase
      .from(table).select('*').eq('project_id', params.id)
    if (rErr) continue
    if (rws && rws.length) {
      const newRows = rws.map((r: any) => {
        const o: any = { ...r }
        delete o.id
        delete o.created_at
        delete o.updated_at
        o.project_id = newProj.id
        return o
      })
      const { error: rowsErr } = await supabase.from(table).insert(newRows)
      if (rowsErr) return NextResponse.json({ error: 'Project copied but rows failed: ' + rowsErr.message, project: newProj }, { status: 500 })
      copied = rws.length
    }
    break
  }

  await supabase.from('activity_log').insert({
    project_id: newProj.id, actor: auth.actor,
    action: `Duplicated from "${orig.name}" (${copied} rows copied)`,
  })

  return NextResponse.json({ ...newProj, rows_copied: copied })
}
