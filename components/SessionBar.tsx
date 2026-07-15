'use client'
import { useEffect, useRef, useState } from 'react'

const IDLE_WARNING_AFTER_MS = 15 * 60 * 1000 // 15 minutes of no activity
const WARNING_COUNTDOWN_MS = 60 * 1000        // then 60s to respond before auto sign-out

// Drop this into any page. Shows "Hi {name}" + Sign Out when logged in, or a
// Sign In link when not. Independently of that, if the user has been idle
// (no mouse/keyboard/click activity) for 15 minutes, shows a warning modal
// giving them 60 seconds to say they're still there before automatically
// signing them out — this only runs while actually on a page using this
// component, it does not run in the background across the whole site.
export default function SessionBar({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [me, setMe] = useState<{signedIn:boolean,name?:string,role?:string}|null>(null)
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [countdown, setCountdown] = useState(Math.floor(WARNING_COUNTDOWN_MS/1000))
  const idleTimer = useRef<any>(null)
  const countdownTimer = useRef<any>(null)

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' }).then(r=>r.json()).then(setMe).catch(()=>setMe({signedIn:false}))
  }, [])

  useEffect(() => {
    if (!me?.signedIn) return // no point tracking idle time for a logged-out visitor

    const resetIdleTimer = () => {
      if (showIdleWarning) return // don't reset while the warning is already up — that's what the modal buttons are for
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setShowIdleWarning(true), IDLE_WARNING_AFTER_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdleTimer))
    resetIdleTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      clearTimeout(idleTimer.current)
    }
  }, [me?.signedIn, showIdleWarning])

  useEffect(() => {
    if (!showIdleWarning) { setCountdown(Math.floor(WARNING_COUNTDOWN_MS/1000)); return }
    countdownTimer.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownTimer.current)
          window.location.href = '/auth/logout'
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(countdownTimer.current)
  }, [showIdleWarning])

  const extendSession = () => {
    setShowIdleWarning(false)
    clearInterval(countdownTimer.current)
  }

  const isDark = variant === 'dark'
  const textColor = isDark ? 'rgba(255,255,255,.85)' : '#1C1C1E'
  const mutedColor = isDark ? 'rgba(255,255,255,.5)' : '#9AA5B4'

  return (
    <>
      {me?.signedIn ? (
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:textColor}}>Hi, {me.name}</span>
          <a href="/auth/logout" style={{fontSize:11,color:mutedColor,textDecoration:'none',border:`1px solid ${isDark?'rgba(255,255,255,.2)':'#E2DDD6'}`,padding:'5px 12px',borderRadius:6}}>Sign Out</a>
        </div>
      ) : me ? (
        <a href="/auth/login" style={{fontSize:12,color:isDark?'#fff':'#1C1C1E',background:isDark?'rgba(255,255,255,.1)':'#C9A84C',textDecoration:'none',padding:'7px 16px',borderRadius:6,fontWeight:700}}>Sign In</a>
      ) : null}

      {showIdleWarning && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'#fff',borderRadius:12,padding:28,width:360,maxWidth:'90vw',boxShadow:'0 24px 64px rgba(0,0,0,.3)',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:10}}>⏰</div>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:18,marginBottom:8}}>Still there?</div>
            <p style={{fontSize:13,color:'#4A5568',marginBottom:6}}>You've been idle for a while. For your security, you'll be signed out in:</p>
            <div style={{fontSize:28,fontWeight:700,color:'#E53E3E',marginBottom:18}}>{countdown}s</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <a href="/auth/logout" style={{background:'#F7F4EF',border:'1px solid #E2DDD6',color:'#4A5568',padding:'9px 18px',borderRadius:7,fontSize:13,textDecoration:'none'}}>Sign Out Now</a>
              <button onClick={extendSession} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'9px 20px',borderRadius:7,fontSize:13,fontWeight:700,cursor:'pointer'}}>Stay Signed In</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
