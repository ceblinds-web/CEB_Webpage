import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { customerId, name, email, phone, address, property_type } = body
  if (!customerId || !name || !email) {
    return NextResponse.json({ error: 'customerId, name and email are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('projects').insert({
    customer_id: customerId, name, email, phone: phone || null, address: address || null,
    property_type: property_type || 'Residential – Single Family', status: 'draft',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    project_id: data.id, actor: auth.actor, action: `Project "${name}" created`,
  })

  return NextResponse.json(data)
}
