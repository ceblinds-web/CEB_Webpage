import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

// Deliberately a separate path from /api/customers (which likely already has a GET
// handler powering the sidebar) rather than adding POST to that same file blind —
// safer than risking overwriting a handler I can't see.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { name, email, phone, status } = body
  if (!name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('customers').insert({
    name, email, phone: phone || null, status: status || 'active',
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A customer with that email already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
