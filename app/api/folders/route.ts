import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const s = db()
  const { data: folders, error } = await s.from('folders').select('*').order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const { data: projs } = await s.from('projects').select('id,folder_id').not('folder_id', 'is', null)
  const mapping: Record<string, string> = {}
  ;(projs || []).forEach((p: any) => { mapping[p.id] = p.folder_id })
  return Response.json({ folders: folders || [], mapping })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (!body.customer_id || !body.name?.trim())
    return Response.json({ error: 'customer_id and name required' }, { status: 400 })
  const { data, error } = await db()
    .from('folders')
    .insert({ customer_id: body.customer_id, name: body.name.trim() })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
