import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Update simple payment status fields on a project
export async function PATCH(req: Request) {
  const body = await req.json()
  if (!body.project_id) return NextResponse.json({ error:'project_id required' }, { status:400 })
  const sb = createAdminClient()
  const update: any = {}
  if (body.deposit_pct !== undefined) update.deposit_pct = body.deposit_pct
  if (body.deposit_paid !== undefined) {
    update.deposit_paid = body.deposit_paid
    update.deposit_paid_at = body.deposit_paid ? new Date().toISOString() : null
  }
  if (body.full_payment_paid !== undefined) {
    update.full_payment_paid = body.full_payment_paid
    update.full_payment_paid_at = body.full_payment_paid ? new Date().toISOString() : null
  }
  const { data, error } = await sb.from('projects').update(update).eq('id', body.project_id).select().single()
  if (error) return NextResponse.json({ error }, { status:500 })
  return NextResponse.json(data)
}
