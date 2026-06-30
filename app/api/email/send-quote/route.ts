import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const { projectId } = await req.json()
  const supabase = createAdminClient()

  const { data: project } = await supabase
    .from('projects').select('*, customers(name, email)').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quote/${projectId}`
  const customer = (project as any).customers

  // When you add Resend: import { Resend } from 'resend'
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: process.env.EMAIL_FROM, to: project.email, subject: '...', html: '...' })

  // For now, log the event and mark sent
  await supabase.from('projects').update({ status: 'sent' }).eq('id', projectId)
  await supabase.from('email_events').insert({
    project_id: projectId, customer_id: project.customer_id,
    event_type: 'quote_sent', email_to: project.email,
  })

  return NextResponse.json({ success: true, viewUrl })
}
