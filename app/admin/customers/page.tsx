import { redirect } from 'next/navigation'

// The customer list + create-customer/create-project forms that used to live
// here have moved into /admin/home's main panel. This route is kept so old
// bookmarks/links don't 404 — it just forwards through.
export default function AdminCustomersRedirect() {
  redirect('/admin/home')
}
