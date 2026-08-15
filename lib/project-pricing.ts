import { createAdminClient } from '@/lib/supabase-server'

// Merges global defaults with this project's overrides. A row with
// isOverride:true came from project_products/project_motors; otherwise
// it's the shared default every project starts from.
export async function getMergedPricing(projectId: string) {
  const sb = createAdminClient()
  const [{ data: products }, { data: motors }, { data: pProducts }, { data: pMotors }] = await Promise.all([
    sb.from('products').select('*'),
    sb.from('motors').select('*'),
    sb.from('project_products').select('*').eq('project_id', projectId),
    sb.from('project_motors').select('*').eq('project_id', projectId),
  ])
  const opMap = new Map((pProducts || []).map((o: any) => [o.name, o]))
  const omMap = new Map((pMotors || []).map((o: any) => [o.name, o]))
  const mergedProducts = (products || []).map((p: any) => {
    const o = opMap.get(p.name)
    return o
      ? { ...p, my_cost_per_sqm: Number(o.my_cost_per_sqm), factor: Number(o.factor), isOverride: true, defaultCost: Number(p.my_cost_per_sqm), defaultFactor: Number(p.factor) }
      : { ...p, isOverride: false }
  })
  const mergedMotors = (motors || []).map((m: any) => {
    const o = omMap.get(m.name)
    return o
      ? { ...m, my_cost_per_unit: Number(o.my_cost_per_unit), factor: Number(o.factor), isOverride: true, defaultCost: Number(m.my_cost_per_unit), defaultFactor: Number(m.factor) }
      : { ...m, isOverride: false }
  })
  return { products: mergedProducts, motors: mergedMotors }
}

// Merges for MANY projects at once (Reports). Returns a function you call per projectId.
export async function getMergedPricingForAllProjects() {
  const sb = createAdminClient()
  const [{ data: products }, { data: motors }, { data: pProductsAll }, { data: pMotorsAll }] = await Promise.all([
    sb.from('products').select('name, my_cost_per_sqm, factor'),
    sb.from('motors').select('name, my_cost_per_unit, factor'),
    sb.from('project_products').select('*'),
    sb.from('project_motors').select('*'),
  ])
  const pProdByProject: Record<string, any[]> = {}
  for (const o of pProductsAll || []) { (pProdByProject[o.project_id] ||= []).push(o) }
  const pMotorByProject: Record<string, any[]> = {}
  for (const o of pMotorsAll || []) { (pMotorByProject[o.project_id] ||= []).push(o) }

  return (projectId: string) => {
    const opMap = new Map((pProdByProject[projectId] || []).map((o: any) => [o.name, o]))
    const omMap = new Map((pMotorByProject[projectId] || []).map((o: any) => [o.name, o]))
    const mp = (products || []).map((p: any) => opMap.has(p.name) ? { ...p, ...opMap.get(p.name) } : p)
    const mm = (motors || []).map((m: any) => omMap.has(m.name) ? { ...m, ...omMap.get(m.name) } : m)
    return { products: mp, motors: mm }
  }
}
