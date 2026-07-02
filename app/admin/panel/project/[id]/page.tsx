// app/admin/panel/project/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { calculateProjectTotal } from '@/lib/pricing'
import type { ProjectRow, Product, Motor, ProjectConfig, ProjectFee } from '@/lib/pricing'
import ProjectPanelClient from './ProjectPanelClient'

export default async function ProjectAdminPanelPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer')

  const { data: project, error: projectErr } = await supabase
    .from('projects').select('*, customers(id, name, email, phone, discount_pct, discount_reason)')
    .eq('id', params.id).single()
  if (projectErr || !project) notFound()

  const [
    { data: rows },
    { data: config },
    { data: fees },
    { data: products },
    { data: motors },
    { data: invoices },
    { data: payments },
    { data: grievances },
    { data: emails },
  ] = await Promise.all([
    supabase.from('project_rows').select('*').eq('project_id', params.id).order('sort_order'),
    supabase.from('project_config').select('*').eq('project_id', params.id).maybeSingle(),
    supabase.from('project_fees').select('*').eq('project_id', params.id).order('sort_order'),
    supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('motors').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('invoices').select('*').eq('project_id', params.id).order('sequence_num'),
    supabase.from('payments').select('*, invoices!inner(project_id)').eq('invoices.project_id', params.id),
    supabase.from('grievances').select('*, grievance_photos(*)').eq('project_id', params.id).order('created_at', { ascending: false }),
    supabase.from('manual_emails').select('*').eq('project_id', params.id).order('sent_at', { ascending: false }),
  ])

  // Recompute the live total from the sheet, so the page can show "unsaved changes"
  // if project_rows/config differ from the last-pushed projects.grand_total.
  let liveTotal = null
  if (rows && config && products && motors) {
    const totals = calculateProjectTotal(
      rows as unknown as ProjectRow[],
      products as unknown as Product[],
      motors as unknown as Motor[],
      config as unknown as ProjectConfig,
      (fees ?? []) as unknown as ProjectFee[],
    )
    liveTotal = totals.grandTotal
  }

  return (
    <ProjectPanelClient
      project={project}
      invoices={invoices ?? []}
      payments={payments ?? []}
      grievances={grievances ?? []}
      emails={emails ?? []}
      liveTotal={liveTotal}
      currentActorEmail={profile.email ?? profile.full_name ?? user.email ?? ''}
    />
  )
}
