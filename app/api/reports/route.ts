import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'

const CONV = 0.00064516

function sqm(w: any, h: any) {
  const s = parseFloat(w || 0) * parseFloat(h || 0) * CONV
  return s > 0 ? Math.max(1, s) : 0
}

// Recomputes a project's full pricing waterfall from its actual rows/config/
// products/motors — the same formula the admin sheet and Per-Window table use.
// This is the only way to get an accurate tax/shipping/COGS split; a flat
// percentage guess (the previous approach) doesn't account for shipping,
// installation, and custom fees also being baked into the same total.
function computeProjectBreakdown(rows: any[], config: any, fees: any[], products: any[], motors: any[]) {
  const dataRows = rows.filter(r => !r.is_section)
  const getProd = (name: string) => products.find(p => p.name === name) || { my_cost_per_sqm: 0, factor: 0 }
  const getMotor = (name: string) => motors.find(m => m.name === name) || { my_cost_per_unit: 0, factor: 0 }

  let totB = 0, totM = 0, totCost = 0
  for (const r of dataRows) {
    const p = getProd(r.blind_type)
    const m = getMotor(r.control)
    const area = sqm(r.width_in, r.height_in)
    const qty = r.qty || 1
    totB += Math.round(area * p.my_cost_per_sqm * p.factor * 100) / 100 * qty
    totM += m.my_cost_per_unit * m.factor * qty
    totCost += Math.round(area * p.my_cost_per_sqm * 100) / 100 * qty + m.my_cost_per_unit * qty
  }

  const discountPct = Number(config?.discount_pct || 0)
  const sub = (totB + totM) * (1 - discountPct / 100)
  const tax = sub * (Number(config?.tax_pct || 0) / 100)
  const ship = sub * (Number(config?.shipping_pct || 0) / 100)
  const install = Number(config?.installation || 0)
  const extraFees = (fees || []).reduce((s, f) => s + (f.fee_type === 'pct' ? sub * (Number(f.value || 0) / 100) : Number(f.value || 0)), 0)
  const grand = sub + tax + ship + install + extraFees
  const grossMargin = sub - totCost // matches the admin's "In-Pocket" definition

  return { totB, totM, totCost, sub, tax, ship, install, extraFees, grand, grossMargin }
}

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createAdminClient()

  const [
    { data: projects },
    { data: invoices },
    { data: payments },
    { data: expenses },
    { data: discountLog },
    { data: configs },
    { data: allFees },
    { data: products },
    { data: motors },
  ] = await Promise.all([
    supabase.from('projects').select('id, name, status, grand_total, customer_id, customers(name)'),
    supabase.from('invoices').select('id, project_id, invoice_number, status, total_amount, pct_of_total, payment_method, square_surcharge, created_at'),
    supabase.from('payments').select('id, invoice_id, amount, payment_method, paid_at'),
    supabase.from('expenses').select('*'),
    supabase.from('discount_log').select('*'),
    supabase.from('project_config').select('*'),
    supabase.from('project_fees').select('*'),
    supabase.from('products').select('name, my_cost_per_sqm, factor'),
    supabase.from('motors').select('name, my_cost_per_unit, factor'),
  ])

  const inRange = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = dateStr.slice(0, 10)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  // Pipeline = projects not yet invoiced/completed/cancelled — i.e. quotes
  // still open, not a promise that this will ever be collected. Previously
  // called "Total Quoted" and summed every project regardless of stage,
  // which made it meaningless to compare against Collected.
  const OPEN_STATUSES = ['draft', 'sent', 'viewed', 'confirmed']
  const pipelineTotal = (projects || [])
    .filter((p: any) => OPEN_STATUSES.includes(p.status))
    .reduce((s: number, p: any) => s + Number(p.grand_total || 0), 0)

  const paymentsInRange = (payments || []).filter((p: any) => inRange(p.paid_at))
  const totalCollected = paymentsInRange.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

  // Only need to reconstruct the pricing breakdown for projects that
  // actually have at least one payment on record at all (not just in-range —
  // the ratios are the same regardless of when payments landed).
  const invoiceById = new Map<string, any>((invoices || []).map((i: any) => [i.id, i]))
  const projectIdsWithPayments = new Set<string>(
    (payments || []).map((p: any) => invoiceById.get(p.invoice_id)?.project_id).filter(Boolean)
  )

  const rowsByProject: Record<string, any[]> = {}
  if (projectIdsWithPayments.size > 0) {
    const { data: allRows } = await supabase
      .from('project_rows').select('*').in('project_id', Array.from(projectIdsWithPayments))
    for (const r of allRows || []) {
      if (!rowsByProject[r.project_id]) rowsByProject[r.project_id] = []
      rowsByProject[r.project_id].push(r)
    }
  }

  const configByProject = new Map<string, any>((configs || []).map((c: any) => [c.project_id, c]))
  const feesByProject: Record<string, any[]> = {}
  for (const f of allFees || []) {
    if (!feesByProject[f.project_id]) feesByProject[f.project_id] = []
    feesByProject[f.project_id].push(f)
  }

  const breakdownByProject = new Map<string, ReturnType<typeof computeProjectBreakdown>>()
  for (const projectId of projectIdsWithPayments) {
    const breakdown = computeProjectBreakdown(
      rowsByProject[projectId] || [],
      configByProject.get(projectId),
      feesByProject[projectId] || [],
      products || [],
      motors || []
    )
    breakdownByProject.set(projectId, breakdown)
  }

  let taxCollected = 0, shippingCollected = 0, cogsInPeriod = 0, grossMarginCollected = 0
  for (const pay of paymentsInRange) {
    const inv: any = invoiceById.get(pay.invoice_id)
    if (!inv) continue
    const breakdown = breakdownByProject.get(inv.project_id)
    if (!breakdown || breakdown.grand <= 0) continue
    const amount = Number(pay.amount || 0)
    taxCollected += amount * (breakdown.tax / breakdown.grand)
    shippingCollected += amount * (breakdown.ship / breakdown.grand)
    cogsInPeriod += amount * (breakdown.totCost / breakdown.grand)
    grossMarginCollected += amount * (breakdown.grossMargin / breakdown.grand)
  }

  const expensesInRange = (expenses || []).filter((e: any) => inRange(e.expense_date))
  const totalExpenses = expensesInRange.reduce((s: number, e: any) => s + Number(e.cost || 0), 0)

  const discountsInRange = (discountLog || []).filter((d: any) => inRange(d.applied_at))
  const totalDiscounts = discountsInRange.reduce((s: number, d: any) => s + Number(d.amount_saved || 0), 0)

  // Net Profit = gross margin actually collected (goods revenue minus goods
  // cost, matching the "In-Pocket" definition used everywhere else) minus
  // operational overhead. Tax and shipping are pass-through, not profit, so
  // they're reported separately rather than folded in here.
  const netProfit = grossMarginCollected - totalExpenses

  const invoicesWithContext = (invoices || []).map((inv: any) => {
    const project: any = (projects || []).find((p: any) => p.id === inv.project_id)
    return { ...inv, project_name: project?.name, customer_name: project?.customers?.name }
  })

  return NextResponse.json({
    pipelineTotal,
    totalCollected,
    taxCollected,
    shippingCollected,
    cogsInPeriod,
    grossMarginCollected,
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
