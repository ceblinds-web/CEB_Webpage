// lib/resend.ts
// Uses Resend's plain REST API via fetch rather than their SDK, so no new npm
// dependency is needed. Returns a result object rather than throwing, so a
// failed send never crashes the calling route — the caller decides how to
// surface it (e.g. "logged, but delivery failed").
export async function sendEmail(params: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false as const, error: 'RESEND_API_KEY is not set — email was logged but not actually sent.' }
  }

  // Until a domain is verified in Resend, sending "from" an unverified domain
  // fails — resend.dev is Resend's own sandbox sender that works immediately,
  // but can only deliver to the email address your Resend account itself is
  // registered with, until you verify ceblinds.click (or another domain).
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Custom Elegant Blinds <onboarding@resend.dev>'

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
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false as const, error: `Resend API error (${res.status}): ${body.slice(0, 300)}` }
    }

    const data = await res.json()
    return { ok: true as const, id: data.id as string }
  } catch (err: any) {
    return { ok: false as const, error: 'Network error contacting Resend: ' + err.message }
  }
}
