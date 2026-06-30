'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/'); router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(145deg,#111,#1e1e22)'}}>
      <div className="bg-white rounded-2xl p-10 w-96 shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-5xl mb-2">🪟</div>
          <h1 className="font-display text-2xl">Custom Elegant Blinds</h1>
          <p className="text-sm text-gray-400 mt-1">Project Portal</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
              placeholder="you@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-gray-700 transition-colors">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">
          No account? <a href="/auth/register" className="text-yellow-700 underline">Register</a>
        </p>
      </div>
    </div>
  )
}
