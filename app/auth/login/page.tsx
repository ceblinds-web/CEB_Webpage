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
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    // Fallback link-check: covers accounts whose signup happened while email
    // confirmation was still pending, so the signup-time link never ran. No-op
    // if already linked or if this is an admin account.
    try { await fetch('/api/auth/link-customer', { method: 'POST' }) } catch {}
    router.push('/'); router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',fontFamily:'Inter,sans-serif'}}>
      {/* Left — branding */}
      <div style={{flex:1,background:'linear-gradient(145deg,#1C1C1E 0%,#2d1515 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 30% 50%,rgba(201,168,76,.08),transparent 60%)'}}/>
        <div style={{height:4,background:'linear-gradient(90deg,#8B1A1A,#C9A84C,#8B1A1A)',position:'absolute',top:0,left:0,right:0}}/>
        <a href="/catalog"><img src="/ceb-logo.jpg" alt="CEB" style={{width:160,height:160,borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(201,168,76,.5)',boxShadow:'0 0 60px rgba(201,168,76,.15)',marginBottom:28,position:'relative',cursor:'pointer'}}/></a>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#fff',textAlign:'center',margin:'0 0 8px',position:'relative'}}>Custom Elegant Blinds</h1>
        <p style={{fontSize:12,color:'rgba(255,255,255,.4)',textAlign:'center',letterSpacing:'1.5px',textTransform:'uppercase',position:'relative'}}>Interior Design · Design & Build · Procurement</p>
        <div style={{position:'relative',marginTop:40,fontSize:11,color:'rgba(255,255,255,.2)',letterSpacing:'1px'}}>customelegantblinds.com · Monroe, WA</div>
      </div>

      {/* Right — login form */}
      <div style={{width:440,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,background:'#fff'}}>
        <div style={{width:'100%',maxWidth:340}}>
          <div style={{marginBottom:36}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1C1C1E',margin:'0 0 6px'}}>Sign In</h2>
            <p style={{fontSize:13,color:'#9AA5B4',margin:0}}>Welcome back to your portal</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:5,letterSpacing:'.3px'}}>EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@email.com"
                style={{width:'100%',padding:'12px 14px',border:'1.5px solid #E2DDD6',borderRadius:8,fontSize:14,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box',transition:'border-color .2s'}}
                onFocus={e=>e.target.style.borderColor='#C9A84C'} onBlur={e=>e.target.style.borderColor='#E2DDD6'}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:5,letterSpacing:'.3px'}}>PASSWORD</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                style={{width:'100%',padding:'12px 14px',border:'1.5px solid #E2DDD6',borderRadius:8,fontSize:14,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor='#C9A84C'} onBlur={e=>e.target.style.borderColor='#E2DDD6'}/>
            </div>
            {error && <p style={{color:'#E53E3E',fontSize:12,marginBottom:12,background:'#FEE2E2',padding:'8px 12px',borderRadius:6}}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{width:'100%',background:'#1C1C1E',color:'#fff',border:'none',padding:'13px',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p style={{textAlign:'center',marginTop:20,fontSize:12,color:'#9AA5B4'}}>
            No account? <a href="/auth/register" style={{color:'#8B6914',fontWeight:600,textDecoration:'none'}}>Register</a>
          </p>
          <p style={{textAlign:'center',marginTop:8,fontSize:12,color:'#9AA5B4'}}>
            <a href="/catalog" style={{color:'#9AA5B4',textDecoration:'none'}}>← Browse our fabric catalog</a>
          </p>
        </div>
      </div>
    </div>
  )
}
