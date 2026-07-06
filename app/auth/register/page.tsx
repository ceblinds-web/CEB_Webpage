'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setNotice('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.name, phone: form.phone } }
    })
    if (error) { setError(error.message); setLoading(false); return }

    // If email confirmation is off, signUp already returns an active session and
    // we can link + redirect right away. If confirmation is required, there's no
    // session yet — the same link check runs again on their first successful
    // login (in /auth/login) as a guaranteed fallback.
    if (!data.session) {
      setNotice('Account created! Check your email to confirm your address, then sign in.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/link-customer', { method: 'POST' })
      const link = await res.json().catch(() => ({}))
      if (link.noMatch) {
        setNotice("Account created, but we couldn't find a CEB project under this email yet. If your advisor already set one up, make sure you registered with the exact same email address — otherwise, reach out to CEB to get connected.")
        setLoading(false)
        return
      }
    } catch {
      // non-fatal — the login-page fallback will retry this
    }

    router.push('/customer'); router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif',background:'linear-gradient(145deg,#1C1C1E 0%,#2d1515 100%)',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 30% 50%,rgba(201,168,76,.08),transparent 60%)'}}/>
      <div style={{height:4,background:'linear-gradient(90deg,#8B1A1A,#C9A84C,#8B1A1A)',position:'absolute',top:0,left:0,right:0}}/>
      <div style={{background:'#fff',borderRadius:16,padding:'40px 40px',width:400,maxWidth:'90vw',boxShadow:'0 24px 64px rgba(0,0,0,.35)',position:'relative'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <img src="/ceb-logo.jpg" alt="CEB" style={{width:64,height:64,objectFit:'contain',marginBottom:10}}/>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:22,color:'#1C1C1E',margin:'0 0 4px'}}>Create Account</h1>
          <p style={{fontSize:12,color:'#9AA5B4',margin:0}}>Custom Elegant Blinds Portal</p>
        </div>
        <form onSubmit={handleRegister}>
          {([['name','Full Name','Your name'],['email','Email','you@email.com'],['phone','Phone (optional)','+1 (425)…']] as const).map(([k,l,p])=>(
            <div key={k} style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:5}}>{l}</label>
              <input type={k==='email'?'email':'text'} value={(form as any)[k]} required={k!=='phone'}
                onChange={e=>setForm({...form,[k]:e.target.value})}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #E2DDD6',borderRadius:8,fontSize:13,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box'}}
                placeholder={p}/>
            </div>
          ))}
          <div style={{marginBottom:18}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:5}}>Password</label>
            <input type="password" value={form.password} required onChange={e=>setForm({...form,password:e.target.value})}
              style={{width:'100%',padding:'10px 12px',border:'1.5px solid #E2DDD6',borderRadius:8,fontSize:13,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box'}}
              placeholder="Create a password"/>
          </div>
          {error && <p style={{color:'#E53E3E',fontSize:12,marginBottom:14,background:'#FEE2E2',padding:'8px 12px',borderRadius:6}}>{error}</p>}
          {notice && <p style={{color:'#92400E',fontSize:12,marginBottom:14,background:'#FEF3C7',padding:'8px 12px',borderRadius:6,lineHeight:1.5}}>{notice}</p>}
          <button type="submit" disabled={loading}
            style={{width:'100%',background:'#1C1C1E',color:'#fff',border:'none',padding:'12px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p style={{textAlign:'center',fontSize:12,color:'#9AA5B4',marginTop:16}}>
          Already have an account? <a href="/auth/login" style={{color:'#8B6914',fontWeight:600,textDecoration:'none'}}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
