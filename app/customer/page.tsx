import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: customer } = await supabase
    .from('customers').select('*').eq('profile_id', session.user.id).single()

  const { data: projects } = await supabase
    .from('projects').select('*').eq('customer_id', customer?.id).order('created_at', { ascending: false })

  return (
    <div className="min-h-screen" style={{background:'#F7F4EF'}}>
      <header className="bg-gray-900 h-14 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-base">🪟</div>
          <span className="font-display text-white text-base">Custom <span className="text-yellow-400">Elegant</span> Blinds</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white text-sm">{customer?.name}</span>
          <a href="/auth/logout" className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Sign Out</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl mb-2">My Projects</h1>
        <p className="text-gray-500 text-sm mb-8">Your window treatment quotes and orders</p>
        <div className="grid gap-4">
          {projects?.map(p => (
            <a key={p.id} href={`/customer/project/${p.id}`}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-yellow-400 hover:shadow-md transition-all flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{p.name}</div>
                <div className="text-sm text-gray-500 mt-1">{p.address || p.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  p.status==='confirmed'?'bg-teal-100 text-teal-700':
                  p.status==='sent'?'bg-blue-100 text-blue-700':
                  'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                <span className="text-gray-400">→</span>
              </div>
            </a>
          ))}
          {!projects?.length && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p>No projects yet. Your CEB advisor will create one for you.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
