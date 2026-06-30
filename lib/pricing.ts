// ═══════════════════════════════════════════════════════════════
// Shared pricing engine — same logic as the HTML prototype
// Used in both server API routes and client components
// ═══════════════════════════════════════════════════════════════

const CONV = 0.00064516 // sq inches → sq meters

export function sqm(widthIn: number, heightIn: number): number {
  return widthIn * heightIn * CONV
}

export function blindsQuote(
  widthIn: number,
  heightIn: number,
  qty: number,
  costPerSqm: number,
  factor: number
): number {
  return Math.round(sqm(widthIn, heightIn) * costPerSqm * factor * 100) / 100 * qty
}

export function motorQuote(qty: number, motorCost: number, motorFactor: number): number {
  return motorCost * motorFactor * qty
}

export function calculateProjectTotal(
  rows: ProjectRow[],
  products: Product[],
  motors: Motor[],
  config: ProjectConfig,
  fees: ProjectFee[]
): ProjectTotals {
  const dataRows = rows.filter(r => !r.is_section)

  const totalBlinds = dataRows.reduce((sum, row) => {
    const prod = products.find(p => p.name === row.blind_type)
    if (!prod || !row.width_in || !row.height_in) return sum
    const cost = row.cost_override ?? prod.my_cost_per_sqm
    const factor = row.factor_override ?? prod.factor
    return sum + blindsQuote(row.width_in, row.height_in, row.qty, cost, factor)
  }, 0)

  const totalMotors = dataRows.reduce((sum, row) => {
    const motor = motors.find(m => m.name === row.control)
    if (!motor) return sum
    return sum + motorQuote(row.qty, motor.my_cost_per_unit, motor.factor)
  }, 0)

  const discountAmt = (totalBlinds + totalMotors) * (config.discount_pct / 100)
  const subtotal = (totalBlinds + totalMotors) - discountAmt
  const tax = subtotal * (config.tax_pct / 100)
  const shipping = subtotal * (config.shipping_pct / 100)
  const extraFees = fees.reduce((sum, f) =>
    sum + (f.fee_type === 'pct' ? subtotal * (f.value / 100) : f.value), 0)
  const grandTotal = subtotal + tax + shipping + config.installation + extraFees

  return { totalBlinds, totalMotors, discountAmt, subtotal, tax, shipping, grandTotal, extraFees }
}

export interface ProjectRow {
  is_section: boolean; blind_type?: string; control?: string
  width_in?: number; height_in?: number; qty: number
  cost_override?: number; factor_override?: number
}
export interface Product { name: string; my_cost_per_sqm: number; factor: number }
export interface Motor  { name: string; my_cost_per_unit: number; factor: number }
export interface ProjectConfig {
  tax_pct: number; shipping_pct: number; discount_pct: number
  discount_reason?: string; installation: number
}
export interface ProjectFee { fee_type: 'flat' | 'pct'; value: number; label: string }
export interface ProjectTotals {
  totalBlinds: number; totalMotors: number; discountAmt: number
  subtotal: number; tax: number; shipping: number
  grandTotal: number; extraFees: number
}
