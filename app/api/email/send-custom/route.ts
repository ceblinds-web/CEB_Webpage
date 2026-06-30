import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const { projectId, to, subject, body } = await req.json()
  if (!projectId || !to || !subject || !body) {
    return NextResponse.json({ error:'projectId, to, subject, and body are required' }, { status:400 })
  }
  const sb = createAdminClient()

  // TODO: wire up Resend once RESEND_API_KEY is set
  // const { Resend } = await import('resend')
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, html: body.replace(/\n/g,'<br>') })

  await sb.from('manual_emails').insert({ project_id: projectId, to_email: to, subject, body })
  return NextResponse.json({ success:true })
}
