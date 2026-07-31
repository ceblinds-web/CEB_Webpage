import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  if (!body.name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  const { data, error } = await db()
    .from('folders')
    .update({ name: body.name.trim() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // projects.folder_id has ON DELETE SET NULL → projects fall back to Unfiled
  const { error } = await db().from('folders').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
