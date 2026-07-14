// lib/square.ts
// Creates a Square-hosted Payment Link for a given invoice amount. Square
// hosts the actual checkout page (card form, Apple/Google Pay, etc.) — this
// app never touches card details directly, which is both simpler and safer.
export async function createSquarePaymentLink(params: { invoiceNumber: string; amount: number; note?: string }) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'

  if (!accessToken || !locationId) {
    return { ok: false as const, error: 'Square is not configured — SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID missing.' }
  }

  const baseUrl = environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

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
            // Square wants the smallest currency unit (cents), never a float dollar amount.
            amount: Math.round(params.amount * 100),
            currency: 'USD',
          },
          location_id: locationId,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false as const, error: `Square API error (${res.status}): ${body.slice(0, 300)}` }
    }

    const data = await res.json()
    const url = data.payment_link?.url as string | undefined
    if (!url) return { ok: false as const, error: 'Square accepted the request but returned no payment URL.' }
    return { ok: true as const, url, environment }
  } catch (err: any) {
    return { ok: false as const, error: 'Network error contacting Square: ' + err.message }
  }
}
