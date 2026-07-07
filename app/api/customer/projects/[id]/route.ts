import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  // Deliberately the RLS-respecting client, not the service-role one — this is the
  // actual security boundary. If this project doesn't belong to the signed-in
  // customer, RLS returns nothing and this 404s, exactly like the page already did.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, customers(id, name, email), project_rows(*), project_config(*), project_fees(*)')
    .eq('id', params.id).single()
  if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  if (project.status === 'sent') {
    await supabase.from('projects').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', params.id)
    project.status = 'viewed'
  }

  // invoices already has an RLS policy letting a customer read their own
  // project's invoices, so this uses the same RLS-respecting client as above.
  const { data: invoices } = await supabase
    .from('invoices').select('*').eq('project_id', params.id).order('sequence_num')

  // products/motors are needed to compute the same Blinds$/Motors$ the admin sheet
  // shows, but only the sell-side numbers (cost_per_sqm * factor) ever reach the
  // client below — raw my_cost_per_sqm/my_cost_per_unit are never exposed here.
  const admin = createAdminClient()
  const [{ data: products }, { data: motors }] = await Promise.all([
    admin.from('products').select('name, my_cost_per_sqm, factor').eq('is_active', true),
    admin.from('motors').select('name, my_cost_per_unit, factor').eq('is_active', true),
  ])

  const CONV = 0.00064516
  const sqm = (w: any, h: any) => parseFloat(w || 0) * parseFloat(h || 0) * CONV
  const priceLookup = (products ?? []).map((p: any) => ({ name: p.name, quotePerSqm: p.my_cost_per_sqm * p.factor }))
  const motorLookup = (motors ?? []).map((m: any) => ({ name: m.name, quotePerUnit: m.my_cost_per_unit * m.factor }))

  return NextResponse.json({ ...project, invoices: invoices ?? [], _pricing: { priceLookup, motorLookup, CONV } })
}
