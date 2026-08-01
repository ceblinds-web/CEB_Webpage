import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/require-admin'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

const CONV = 0.00064516
// Same rule as the sheet editor: minimum billable 1 sq.m, rounded UP to 0.01
const sqm = (w: any, h: any) => {
  const s = (parseFloat(w || 0) * parseFloat(h || 0)) * CONV
  return s > 0 ? Math.max(1, Math.ceil(s * 100) / 100) : 0
}
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()

  const { data: project, error: pErr } = await supabase
    .from('projects').select('*').eq('id', params.id).single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const [{ data: rows }, { data: cfgRow }, { data: fees }, { data: products }, { data: motors }] = await Promise.all([
    supabase.from('project_rows').select('*').eq('project_id', params.id).order('sort_order'),
    supabase.from('project_config').select('*').eq('project_id', params.id).maybeSingle(),
    supabase.from('project_fees').select('*').eq('project_id', params.id),
    supabase.from('products').select('*'),
    supabase.from('motors').select('*'),
  ])

  let customerName = ''
  if (project.customer_id) {
    const { data: cust } = await supabase.from('customers').select('name,email').eq('id', project.customer_id).maybeSingle()
    customerName = cust?.name || ''
  }

  const config = {
    tax_pct: Number(cfgRow?.tax_pct ?? 10),
    shipping_pct: Number(cfgRow?.shipping_pct ?? 18),
    discount_pct: Number(cfgRow?.discount_pct ?? 0),
    discount_reason: cfgRow?.discount_reason ?? '',
    installation: Number(cfgRow?.installation ?? 500),
  }

  // Exact same pricing as the sheet editor
  const getProd = (type: string) => (products || []).find((p: any) => p.name === type) || { my_cost_per_sqm: 16, factor: 5 }
  const getMtr = (ctrl: string) => (motors || []).find((m: any) => m.name === ctrl) || { my_cost_per_unit: 0, factor: 1 }
  const isPriced = (r: any) => r.priced !== false
  const blindsQ = (r: any) => { if (!isPriced(r)) return 0; const p = getProd(r.blind_type); return r2(sqm(r.width_in, r.height_in) * Number(p.my_cost_per_sqm) * Number(p.factor)) * (Number(r.qty) || 1) }
  const motorQ = (r: any) => { if (!isPriced(r)) return 0; const m = getMtr(r.control); return Number(m.my_cost_per_unit) * Number(m.factor) * (Number(r.qty) || 1) }
  const lineTotal = (r: any) => (blindsQ(r) + motorQ(r)) * (1 - config.discount_pct / 100)

  const all = rows || []
  const dataRows = all.filter((r: any) => !r.is_section)
  const totB = dataRows.reduce((s: number, r: any) => s + blindsQ(r), 0)
  const totM = dataRows.reduce((s: number, r: any) => s + motorQ(r), 0)
  const totSqm = dataRows.reduce((s: number, r: any) => s + sqm(r.width_in, r.height_in) * (parseInt(String(r.qty)) || 1), 0)
  const sub = (totB + totM) * (1 - config.discount_pct / 100)
  const ship = sub * (config.shipping_pct / 100)
  const tax = sub * (config.tax_pct / 100)
  const feeList = (fees || []).map((f: any) => ({ label: f.label, amt: f.fee_type === 'pct' ? sub * (Number(f.value) / 100) : Number(f.value) }))
  const extraTotal = feeList.reduce((s, f) => s + f.amt, 0)
  const grand = sub + tax + ship + config.installation + extraTotal

  // ── Sheet 1: the project sheet, exactly as displayed ──
  const header = ['#', 'Location', 'Blind Type', 'Control', 'Fabric', 'Valance', 'Bottom Rail', 'Mount', 'W (in)', 'H (in)', 'Qty', 'Sq.M', 'Blinds $', 'Motors $', 'Line Total', 'Included']
  const aoa: any[][] = [header]
  let vi = 0
  for (const r of all) {
    if (r.is_section) { aoa.push(['', `▸ ${r.section_name || 'SECTION'}`]); continue }
    vi++
    const sq = sqm(r.width_in, r.height_in)
    aoa.push([
      vi,
      r.location || '',
      r.blind_type || '',
      r.control || '',
      r.fabric || '',
      r.valance || '',
      r.bottom_rail || '',
      r.mount || '',
      r.width_in !== null && r.width_in !== '' ? Number(r.width_in) : '',
      r.height_in !== null && r.height_in !== '' ? Number(r.height_in) : '',
      Number(r.qty) || 1,
      sq > 0 ? sq : '',
      r2(blindsQ(r)),
      r2(motorQ(r)),
      r2(lineTotal(r)),
      isPriced(r) ? 'Yes' : 'EXCLUDED',
    ])
  }
  aoa.push([])
  aoa.push(['', 'TOTALS', '', '', '', '', '', '', '', '', '', r2(totSqm), r2(totB * (1 - config.discount_pct / 100)), r2(totM * (1 - config.discount_pct / 100)), r2(sub)])
  aoa.push([])
  aoa.push(['', 'Blinds & Motors (after discount)', r2(sub)])
  if (config.discount_pct > 0) aoa.push(['', `Discount (${config.discount_pct}%)${config.discount_reason ? ' — ' + config.discount_reason : ''}`, -r2((totB + totM) * config.discount_pct / 100)])
  aoa.push(['', `Tax (${config.tax_pct}%)`, r2(tax)])
  aoa.push(['', `Shipping (${config.shipping_pct}%)`, r2(ship)])
  aoa.push(['', 'Installation', r2(config.installation)])
  for (const f of feeList) aoa.push(['', f.label, r2(f.amt)])
  aoa.push(['', 'GRAND TOTAL', r2(grand)])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 4 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 9 },
    { wch: 8 }, { wch: 8 }, { wch: 5 }, { wch: 8 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 10 },
  ]

  // ── Sheet 2: clean project info (no internal IDs) ──
  const infoAoa = [
    ['Custom Elegant Blinds — Project Export'],
    [],
    ['Project', project.name || ''],
    ['Customer', customerName],
    ['Email', project.email || ''],
    ['Phone', project.phone || ''],
    ['Address', project.address || ''],
    ['Status', project.status || ''],
    ['Grand Total (last pushed)', project.grand_total != null ? Number(project.grand_total) : ''],
    ['Grand Total (current sheet)', r2(grand)],
    ['Exported', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(infoAoa)
  wsInfo['!cols'] = [{ wch: 26 }, { wch: 44 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Project Sheet')
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Project Info')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fname = `CEB_${String(project.name || 'Project').replace(/[^a-zA-Z0-9_-]+/g, '_')}.xlsx`
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}
