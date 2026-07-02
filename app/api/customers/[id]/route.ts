import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

// NOTE: only adding DELETE here. If a customers/[id]/route.ts already exists in your
// codebase with GET/PATCH handlers, merge this DELETE into that file instead of
// letting this overwrite it — the install script only writes this file if it's missing.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  // projects.customer_id has ON DELETE CASCADE, so this also removes their projects
  const { error } = await supabase.from('customers').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
