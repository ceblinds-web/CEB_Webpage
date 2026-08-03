import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'
const BUCKET = 'project-attachments'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET)
    .list(params.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) return NextResponse.json({ error: error.message + ' — did you create the public "project-attachments" bucket in Supabase Storage?' }, { status: 500 })

  const files = (data || [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => ({
      name: f.name,
      label: f.name.replace(/^\d+_/, ''),
      url: supabase.storage.from(BUCKET).getPublicUrl(`${params.id}/${f.name}`).data.publicUrl,
      created_at: (f as any).created_at || null,
      size: (f as any).metadata?.size || null,
      isImage: /\.(jpe?g|png|gif|webp)$/i.test(f.name),
    }))
  return NextResponse.json(files)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 400 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const path = `${params.id}/${Date.now()}_${safeName}`

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (error) return NextResponse.json({ error: error.message + ' — did you create the public "project-attachments" bucket in Supabase Storage?' }, { status: 500 })

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return NextResponse.json({ name: path.split('/').pop(), url })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET).remove([`${params.id}/${name}`])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
