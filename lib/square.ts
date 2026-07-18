// lib/square.ts
// Creates a Square-hosted Payment Link for a given invoice amount. Square
// hosts the actual checkout page (card form, Apple/Google Pay, etc.) — this
// app never touches card details directly.
//
// TEMPORARY: verbose logging added at every step so Vercel's Runtime Logs
// show exactly what's configured and what Square actually said, since the
// 401 has persisted past the first round of environment-variable checks.
export async function createSquarePaymentLink(params: { invoiceNumber: string; amount: number; note?: string }) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'

  console.log('[square] createSquarePaymentLink called. environment=%s locationIdPresent=%s accessTokenPresent=%s accessTokenPrefix=%s accessTokenLength=%s',
    environment, !!locationId, !!accessToken, accessToken ? accessToken.slice(0, 8) + '…' : 'none', accessToken ? accessToken.length : 0)

  if (!accessToken || !locationId) {
    console.error('[square] Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID in this environment')
    return { ok: false as const, error: 'Square is not configured — SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID missing.' }
  }

  const baseUrl = environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
  console.log('[square] Using base URL: %s (environment=%s)', baseUrl, environment)

  // Sandbox tokens conventionally start with "EAAAl" and production tokens
  // with "EAAAE" — not a guaranteed rule, but a useful sanity signal to log.
  if (accessToken.startsWith('EAAAl') && environment === 'production') {
    console.warn('[square] WARNING: token prefix looks like a SANDBOX token but SQUARE_ENVIRONMENT=production — likely mismatch')
  }
  if (accessToken.startsWith('EAAAE') && environment !== 'production') {
    console.warn('[square] WARNING: token prefix looks like a PRODUCTION token but SQUARE_ENVIRONMENT=%s — likely mismatch', environment)
  }

  try {
    const res = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17',
      },
      body: JSON.stringify({
        idempotency_key: `inv-${params.invoiceNumber}-${Date.now()}`,
        quick_pay: {
          name: `Invoice ${params.invoiceNumber} — Custom Elegant Blinds`,
          price_money: {
            amount: Math.round(params.amount * 100),
            currency: 'USD',
          },
          location_id: locationId,
        },
      }),
    })

    console.log('[square] Square API responded with status', res.status)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[square] Square API error body:', body)
      return { ok: false as const, error: `Square API error (${res.status}): ${body.slice(0, 300)}` }
    }

    const data = await res.json()
    console.log('[square] Square accepted the request, payment link id=', data.payment_link?.id)
    const url = data.payment_link?.url as string | undefined
    if (!url) return { ok: false as const, error: 'Square accepted the request but returned no payment URL.' }
    return { ok: true as const, url, environment }
  } catch (err: any) {
    console.error('[square] fetch to Square threw:', err)
    return { ok: false as const, error: 'Network error contacting Square: ' + err.message }
  }
}
