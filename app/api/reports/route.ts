import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to')

  const supabase = createAdminClient()

  const [
    { data: projects },
    { data: invoices },
    { data: payments },
    { data: expenses },
    { data: discountLog },
    { data: configs },
  ] = await Promise.all([
    supabase.from('projects').select('id, name, status, grand_total, customer_id, customers(name)'),
    supabase.from('invoices').select('id, project_id, invoice_number, status, total_amount, pct_of_total, payment_method, square_surcharge, created_at'),
    supabase.from('payments').select('id, invoice_id, amount, payment_method, paid_at'),
    supabase.from('expenses').select('*'),
    supabase.from('discount_log').select('*'),
    supabase.from('project_config').select('project_id, tax_pct'),
  ])

  const inRange = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = dateStr.slice(0, 10)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  const totalQuoted = (projects || []).reduce((s: number, p: any) => s + Number(p.grand_total || 0), 0)

  const paymentsInRange = (payments || []).filter((p: any) => inRange(p.paid_at))
  const totalCollected = paymentsInRange.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

  // Approximate tax collected. The schema stores tax_pct on project_config (current setting),
  // not locked to each invoice at creation time, so this multiplies each payment by whatever
  // that project's CURRENT tax rate is — accurate unless the rate changed after the invoice
  // was issued. A precise figure would need a tax_pct column captured on invoices themselves.
  const invoiceById = new Map((invoices || []).map((i: any) => [i.id, i]))
  const configByProject = new Map((configs || []).map((c: any) => [c.project_id, c]))
  let taxCollected = 0
  for (const pay of paymentsInRange) {
    const inv: any = invoiceById.get((pay as any).invoice_id)
    if (!inv) continue
    const cfg: any = configByProject.get(inv.project_id)
    const taxPct = Number(cfg?.tax_pct || 0)
    // amount paid included tax+shipping+install proportionally; approximate the tax slice
    // as taxPct / (100+taxPct) of the paid amount — a reasonable estimate, not exact.
    taxCollected += Number(pay.amount || 0) * (taxPct / (100 + taxPct))
  }

  const expensesInRange = (expenses || []).filter((e: any) => inRange(e.expense_date))
  const totalExpenses = expensesInRange.reduce((s: number, e: any) => s + Number(e.cost || 0), 0)

  const discountsInRange = (discountLog || []).filter((d: any) => inRange(d.applied_at))
  const totalDiscounts = discountsInRange.reduce((s: number, d: any) => s + Number(d.amount_saved || 0), 0)

  const netProfit = totalCollected - totalExpenses

  const invoicesWithContext = (invoices || []).map((inv: any) => {
    const project: any = (projects || []).find((p: any) => p.id === inv.project_id)
    return { ...inv, project_name: project?.name, customer_name: project?.customers?.name }
  })

  return NextResponse.json({
    totalQuoted,
    totalCollected,
    taxCollected,
    totalDiscounts,
    totalExpenses,
    netProfit,
    invoiceCount: (invoices || []).length,
    projectCount: (projects || []).length,
    invoices: invoicesWithContext,
    expenses: expensesInRange,
    discountLog: discountsInRange,
    projects,
  })
}
