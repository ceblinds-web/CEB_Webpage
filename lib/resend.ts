// lib/resend.ts
// Uses Resend's plain REST API via fetch rather than their SDK, so no new npm
// dependency is needed. Returns a result object rather than throwing, so a
// failed send never crashes the calling route — the caller decides how to
// surface it (e.g. "logged, but delivery failed").
//
// TEMPORARY: verbose console logging added at every step so Vercel's Runtime
// Logs (Project -> Logs, or the Functions tab on a deployment) show exactly
// what happened server-side, since the client-side toast alone wasn't enough
// to diagnose a "success reported, but Resend shows nothing" mismatch.
export async function sendEmail(params: { to: string; subject: string; text: string; html?: string; attachments?: { filename: string; content: string }[] }) {
  const apiKey = process.env.RESEND_API_KEY
  console.log('[resend] sendEmail called. to=%s subject=%s apiKeyPresent=%s apiKeyPrefix=%s',
    params.to, params.subject, !!apiKey, apiKey ? apiKey.slice(0, 6) + '…' : 'none')

  if (!apiKey) {
    console.error('[resend] RESEND_API_KEY is not set in this environment')
    return { ok: false as const, error: 'RESEND_API_KEY is not set — email was logged but not actually sent.' }
  }

  // Until a domain is verified in Resend, sending "from" an unverified domain
  // fails — resend.dev is Resend's own sandbox sender that works immediately,
  // but can only deliver to the email address your Resend account itself is
  // registered with, until you verify ceblinds.click (or another domain).
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Custom Elegant Blinds <onboarding@resend.dev>'
  console.log('[resend] sending from=%s', fromAddress)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html || `<pre style="font-family:inherit;white-space:pre-wrap">${params.text}</pre>`,
        ...(params.attachments?.length ? { attachments: params.attachments } : {}),
      }),
    })

    console.log('[resend] Resend API responded with status', res.status)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[resend] Resend API error body:', body)
      return { ok: false as const, error: `Resend API error (${res.status}): ${body.slice(0, 300)}` }
    }

    const data = await res.json()
    console.log('[resend] Resend accepted the send, id=', data.id)
    return { ok: true as const, id: data.id as string }
  } catch (err: any) {
    console.error('[resend] fetch to Resend threw:', err)
    return { ok: false as const, error: 'Network error contacting Resend: ' + err.message }
  }
}
