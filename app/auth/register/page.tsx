'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.name, phone: form.phone } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/customer'); router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(145deg,#111,#1e1e22)'}}>
      <div className="bg-white rounded-2xl p-10 w-96 shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-5xl mb-2">🪟</div>
          <h1 className="font-display text-2xl">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">Custom Elegant Blinds Portal</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          {[['name','Full Name','Your name'],['email','Email','you@email.com'],['phone','Phone (optional)','+1 (425)…']].map(([k,l,p])=>(
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
              <input type={k==='email'?'email':'text'} value={(form as any)[k]} required={k!=='phone'}
                onChange={e=>setForm({...form,[k]:e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                placeholder={p} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input type="password" value={form.password} required onChange={e=>setForm({...form,password:e.target.value})}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
              placeholder="Create a password" />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-gray-700">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">
          Already have an account? <a href="/auth/login" className="text-yellow-700 underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
