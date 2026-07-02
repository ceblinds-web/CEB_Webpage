import { redirect } from 'next/navigation'

// /admin/panel's customer/project tree and KPIs have been folded into /admin/reports.
// This route is kept so old bookmarks/links don't 404 — it just forwards through.
export default function AdminPanelRedirect() {
  redirect('/admin/reports')
}
