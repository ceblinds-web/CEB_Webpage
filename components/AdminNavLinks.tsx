// components/AdminNavLinks.tsx
// Shared nav-link cluster used in the header of every admin page, so
// Project Home / Reports / Gallery / Sign Out look and behave identically
// everywhere instead of each page hand-rolling its own version.
'use client'
import SessionBar from './SessionBar'

const LINK_STYLE = {
  fontSize: 12,
  textDecoration: 'none',
  padding: '6px 14px',
  borderRadius: 6,
  fontWeight: 600 as const,
  whiteSpace: 'nowrap' as const,
}

export default function AdminNavLinks({ active }: { active: 'home' | 'reports' | 'gallery' | 'project' | 'none' }) {
  const items: { key: 'home' | 'reports' | 'gallery'; href: string; label: string; activeColor: string }[] = [
    { key: 'home', href: '/admin/home', label: '📋 Project Home', activeColor: '#C9A84C' },
    { key: 'reports', href: '/admin/reports', label: '📈 Reports', activeColor: '#8B6914' },
    { key: 'gallery', href: '/gallery', label: '🖼 Gallery', activeColor: '#C9A84C' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {items.map(item => {
        const isActive = active === item.key
        return (
          <a
            key={item.key}
            href={item.href}
            style={{
              ...LINK_STYLE,
              color: isActive ? '#1C1C1E' : 'rgba(255,255,255,.6)',
              background: isActive ? item.activeColor : 'rgba(255,255,255,.08)',
              border: `1px solid ${isActive ? item.activeColor : 'rgba(255,255,255,.15)'}`,
            }}
          >
            {item.label}
          </a>
        )
      })}
      <SessionBar variant="dark" />
    </div>
  )
}
