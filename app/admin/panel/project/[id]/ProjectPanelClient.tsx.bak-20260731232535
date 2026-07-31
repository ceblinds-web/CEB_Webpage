// app/admin/panel/project/[id]/ProjectPanelClient.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createInvoice, updateInvoice, markInvoicePaid, unmarkInvoicePaid,
  createGrievance, resolveGrievance, uploadGrievancePhoto, sendManualEmail,
} from './actions'

// ── Types (trimmed to what this component actually reads) ──
type Project = {
  id: string; name: string; address: string | null; email: string; status: string
  grand_total: number | null
  customers: { id: string; name: string; email: string; discount_pct: number | null } | null
}
type Invoice = {
  id: string; invoice_number: string; status: string; total_amount: number | null
  sequence_num: number | null; invoice_type: string | null; pct_of_total: number | null
  payment_method: string | null; square_surcharge: number | null
  fully_paid_at: string | null; created_at: string
}
type Grievance = {
  id: string; title: string; description: string | null; status: string
  resolution_note: string | null; created_at: string; resolved_at: string | null
  grievance_photos: { id: string; photo_url: string; caption: string | null }[]
}
type ManualEmail = { id: string; to_email: string; subject: string; body: string; sent_at: string }

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString() : '')

const RED = '#E17368'
const RED_DARK = '#6B1420'
const INK = '#1C1C1E'

export default function ProjectPanelClient({
  project, invoices, grievances, emails, liveTotal, currentActorEmail,
}: {
  project: Project
  invoices: Invoice[]
  payments: unknown[]
  grievances: Grievance[]
  emails: ManualEmail[]
  liveTotal: number | null
  currentActorEmail: string
}) {
  const [tab, setTab] = useState<'invoices' | 'grievances' | 'email'>('invoices')
  const router = useRouter()
  const [, startTransition] = useTransition()

  function refresh() { startTransition(() => router.refresh()) }

  const billedPct = invoices.reduce((s, i) => s + Number(i.pct_of_total ?? 0), 0)
  const paidPct = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.pct_of_total ?? 0), 0)
  const openGrievances = grievances.filter(g => g.status !== 'resolved').length

  return (
    <div className="min-h-screen bg-[#F7F4EF]">
      {/* header */}
      <header className="flex items-center gap-3 bg-[#1C1C1E] px-5 py-3 text-white">
        <img src="/ceb-logo.jpg" alt="Custom Elegant Blinds" className="h-9 w-9 rounded-full object-contain" />
        <div>
          <div className="text-sm font-semibold">{project.name}</div>
          <div className="text-xs text-white/50">{project.customers?.name} · {project.address}</div>
        </div>
        <span className="ml-auto rounded-full px-3 py-1 text-xs font-bold capitalize" style={{ background: `${RED}33`, color: RED }}>
          {project.status}
        </span>
      </header>

      {liveTotal != null && project.grand_total != null && Math.abs(liveTotal - Number(project.grand_total)) > 0.01 && (
        <div className="bg-amber-100 px-5 py-2 text-xs text-amber-800">
          ⚠ The project sheet has unsaved pricing changes ({fmt(liveTotal)}) that don't match the last pushed total ({fmt(project.grand_total)}). Push from the sheet editor to sync.
        </div>
      )}

      {/* tabs */}
      <nav className="flex gap-1 border-b border-[#E2DDD6] bg-white px-4">
        {[
          { key: 'invoices', label: `📄 Invoices${invoices.length ? ` (${invoices.length})` : ''}` },
          { key: 'grievances', label: `⚠️ Grievances${openGrievances ? ` (${openGrievances})` : ''}` },
          { key: 'email', label: '✉️ Email' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className="border-b-2 px-4 py-3 text-sm font-medium"
            style={tab === t.key ? { borderColor: RED, color: INK, fontWeight: 600 } : { borderColor: 'transparent', color: '#9AA5B4' }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-3xl p-5">
        {tab === 'invoices' && (
          <InvoicesTab
            project={project} invoices={invoices} billedPct={billedPct} paidPct={paidPct}
            onChanged={refresh}
          />
        )}
        {tab === 'grievances' && (
          <GrievancesTab project={project} grievances={grievances} onChanged={refresh} />
        )}
        {tab === 'email' && (
          <EmailTab project={project} emails={emails} onChanged={refresh} />
        )}
      </main>
    </div>
  )
}

// ═══════════════════════════ INVOICES ═══════════════════════════

function InvoicesTab({ project, invoices, billedPct, paidPct, onChanged }: {
  project: Project; invoices: Invoice[]; billedPct: number; paidPct: number; onChanged: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [viewing, setViewing] = useState<Invoice | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleMarkPaid(inv: Invoice) {
    setError('')
    startTransition(async () => {
      try {
        if (inv.status === 'paid') await unmarkInvoicePaid(inv.id)
        else await markInvoicePaid(inv.id)
        onChanged()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[#E2DDD6] bg-white p-4">
        <div className="mb-1 flex justify-between text-xs text-[#4A5568]">
          <span>Collection Progress</span>
          <span>{billedPct.toFixed(0)}% billed · {paidPct.toFixed(0)}% paid</span>
        </div>
        <div className="h-2 rounded-full bg-[#F7F4EF]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, paidPct)}%`, background: `linear-gradient(90deg, ${RED}, #27AE60)` }} />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md px-3 py-2 text-sm font-bold text-white"
          style={{ background: RED }}
        >
          ＋ Add Invoice
        </button>
        <div className="text-sm text-[#4A5568]">Project Total: <strong>{fmt(project.grand_total)}</strong></div>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-[#E2DDD6] bg-white">
        {invoices.length === 0 && (
          <div className="p-6 text-sm text-[#9AA5B4]">
            No invoices yet. Push pricing on the project sheet, then "Add Invoice" to start the chain — a new invoice unlocks only once the prior one is paid.
          </div>
        )}
        {invoices.map(inv => (
          <div key={inv.id} className="flex flex-wrap items-center gap-3 border-b border-[#E2DDD6] p-3 last:border-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7F4EF] text-xs font-bold" style={{ color: RED_DARK }}>
              #{inv.sequence_num}
            </div>
            <div className="min-w-[140px] flex-1">
              <div className="text-sm font-semibold">{inv.invoice_number} <span className="font-normal text-[#9AA5B4]">({inv.invoice_type})</span></div>
              <div className="text-xs text-[#9AA5B4]">{inv.pct_of_total}% of total {inv.status === 'paid' ? `· paid ${fmtDate(inv.fully_paid_at)}` : '· ' + inv.status}</div>
            </div>
            <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: inv.payment_method === 'square' ? '#EDE9FF' : '#D1FAE5', color: inv.payment_method === 'square' ? '#7C3AED' : '#27AE60' }}>
              {inv.payment_method === 'square' ? `💳 Square (+${fmt(inv.square_surcharge)})` : '💵 Cash'}
            </span>
            <div className="text-sm font-bold" style={{ color: RED_DARK }}>{fmt(inv.total_amount)}</div>
            <button
              disabled={pending}
              onClick={() => handleMarkPaid(inv)}
              className="rounded px-2 py-1 text-xs font-bold"
              style={inv.status === 'paid' ? { background: '#D1FAE5', color: '#27AE60' } : { background: '#FEF3C7', color: '#92400E' }}
            >
              {inv.status === 'paid' ? '✓ PAID' : 'MARK PAID'}
            </button>
            <button onClick={() => setViewing(inv)} className="rounded border border-[#E2DDD6] px-2 py-1 text-xs">
              👁 View / Send
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddInvoiceModal
          project={project} billedPct={billedPct}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); onChanged() }}
        />
      )}
      {viewing && (
        <InvoiceDocumentModal
          project={project} invoice={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => { onChanged() }}
        />
      )}
    </div>
  )
}

function AddInvoiceModal({ project, billedPct, onClose, onCreated }: {
  project: Project; billedPct: number; onClose: () => void; onCreated: () => void
}) {
  const remaining = 100 - billedPct
  const [pct, setPct] = useState(Math.min(30, remaining))
  const [method, setMethod] = useState<'cash' | 'square'>('cash')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const base = Number(project.grand_total ?? 0) * (pct / 100)
  const surcharge = method === 'square' ? Math.round((((base + 0.30) / (1 - 0.029)) - base) * 100) / 100 : 0

  function submit() {
    setError('')
    startTransition(async () => {
      try { await createInvoice(project.id, pct, method); onCreated() }
      catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <Modal onClose={onClose} title="📄 Add Invoice">
      <p className="mb-3 text-xs text-[#9AA5B4]">Remaining to bill: <strong>{remaining}%</strong></p>
      <label className="mb-1 block text-xs font-semibold">% of Total</label>
      <input type="number" value={pct} min={1} max={remaining} onChange={e => setPct(Number(e.target.value))}
        className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      <label className="mb-1 block text-xs font-semibold">Payment Method</label>
      <select value={method} onChange={e => setMethod(e.target.value as 'cash' | 'square')}
        className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm">
        <option value="cash">💵 Cash</option>
        <option value="square">💳 Square</option>
      </select>
      <div className="mb-3 rounded bg-[#F7F4EF] p-3 text-sm">
        Amount due: <strong style={{ color: RED_DARK }}>{fmt(base + surcharge)}</strong>
        {surcharge > 0 && <span className="text-xs text-[#9AA5B4]"> (incl. {fmt(surcharge)} Square surcharge)</span>}
      </div>
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      <ModalActions onCancel={onClose} onConfirm={submit} confirmLabel="Create Invoice" pending={pending} />
    </Modal>
  )
}

function InvoiceDocumentModal({ project, invoice, onClose, onChanged }: {
  project: Project; invoice: Invoice; onClose: () => void; onChanged: () => void
}) {
  const editable = invoice.status !== 'paid'
  const [pct, setPct] = useState(invoice.pct_of_total ?? 0)
  const [method, setMethod] = useState<'cash' | 'square'>((invoice.payment_method as 'cash' | 'square') ?? 'cash')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const base = Number(project.grand_total ?? 0) * (pct / 100)
  const surcharge = method === 'square' ? Math.round((((base + 0.30) / (1 - 0.029)) - base) * 100) / 100 : 0

  function save() {
    setError('')
    startTransition(async () => {
      try { await updateInvoice(invoice.id, pct, method); onChanged() }
      catch (e) { setError((e as Error).message) }
    })
  }

  function email() {
    setError('')
    startTransition(async () => {
      try {
        const subject = `Invoice ${invoice.invoice_number} — ${invoice.status === 'paid' ? 'Payment Confirmation' : `Due ${fmt(invoice.total_amount)}`}`
        const body = `Hi ${project.customers?.name ?? ''},\n\nPlease find your invoice ${invoice.invoice_number} for ${project.name} attached below.\n\n${invoice.invoice_type?.toUpperCase()} — ${pct}% of project total\nAmount Due: ${fmt(base + surcharge)}\n\nThank you,\nCustom Elegant Blinds`
        await sendManualEmail(project.id, project.customers?.email ?? project.email, subject, body)
        onChanged()
      } catch (e) { setError((e as Error).message) }
    })
  }

  function printDoc() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${invoice.invoice_number}</title><style>
      body{font-family:Arial;padding:32px;max-width:700px;margin:0 auto;color:#1C1C1E;}
      .hdr{display:flex;align-items:center;gap:16px;border-bottom:3px solid ${RED_DARK};padding-bottom:14px;margin-bottom:18px;}
      .hdr img{width:64px;height:64px;object-fit:contain;border-radius:50%;}
      .co{font-family:Georgia,serif;font-size:20px;color:${RED_DARK};font-weight:700;}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
      th{background:#1C1C1E;color:#fff;padding:8px;text-align:left;}
      td{padding:8px;border-bottom:1px solid #eee;}
      .total-row td{font-weight:700;font-size:15px;color:${RED_DARK};border-top:2px solid ${RED_DARK};}
    </style></head><body>
      <div class="hdr"><img src="${window.location.origin}/ceb-logo.jpg"><div><div class="co">Custom Elegant Blinds</div><div>Zebra Blinds · Honey Comb · Dream Curtain</div></div></div>
      <p><strong>Invoice:</strong> ${invoice.invoice_number} &nbsp; <strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
      <p><strong>Bill To:</strong> ${project.customers?.name ?? ''} — ${project.customers?.email ?? ''}</p>
      <table><thead><tr><th>Description</th><th style="text-align:right">%</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>${invoice.invoice_type} — ${project.name}</td><td style="text-align:right">${invoice.pct_of_total}%</td><td style="text-align:right">${fmt(invoice.total_amount)}</td></tr>
        <tr class="total-row"><td colspan="2">Amount Due</td><td style="text-align:right">${fmt(invoice.total_amount)}</td></tr>
      </tbody></table>
    </body></html>`)
    w.document.close(); w.print()
  }

  return (
    <Modal onClose={onClose} title="" wide>
      <div className="rounded-lg border border-[#E2DDD6] bg-white p-5">
        <div className="mb-4 flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: RED_DARK }}>
          <img src="/ceb-logo.jpg" alt="CEB" className="h-12 w-12 rounded-full object-contain" />
          <div className="flex-1">
            <div className="font-serif text-base font-bold" style={{ color: RED_DARK }}>Custom Elegant Blinds</div>
            <div className="text-[10px] text-[#9AA5B4]">Zebra Blinds · Honey Comb · Dream Curtain</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-wide text-[#9AA5B4]">INVOICE</div>
            <div className="text-sm font-bold">{invoice.invoice_number}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="mb-1 font-bold uppercase tracking-wide text-[#9AA5B4]">Bill To</div>
            <div>{project.customers?.name}<br />{project.customers?.email}<br />{project.address}</div>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase tracking-wide text-[#9AA5B4]">Project</div>
            <div>{project.name}</div>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase tracking-wide text-[#9AA5B4]">Status</div>
            <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={invoice.status === 'paid' ? { background: '#D1FAE5', color: '#27AE60' } : { background: '#FEF3C7', color: '#92400E' }}>
              {invoice.status === 'paid' ? '✓ Paid' : 'Due'}
            </span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead><tr className="border-b-2 border-[#E2DDD6] text-left text-xs text-[#4A5568]">
            <th className="pb-2">Description</th><th className="pb-2 text-right">% of Total</th><th className="pb-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-[#E2DDD6]">
              <td className="py-2">{invoice.invoice_type} — {project.name}<br /><span className="text-[10px] text-[#9AA5B4]">Project Total: {fmt(project.grand_total)}</span></td>
              <td className="py-2 text-right">
                {editable
                  ? <input type="number" value={pct} onChange={e => setPct(Number(e.target.value))} className="w-16 rounded border border-[#E17368] px-1 text-right" />
                  : `${pct}%`}
              </td>
              <td className="py-2 text-right">{fmt(base)}</td>
            </tr>
            {surcharge > 0 && (
              <tr><td className="py-2">💳 Square processing surcharge</td><td /><td className="py-2 text-right">{fmt(surcharge)}</td></tr>
            )}
          </tbody>
          <tfoot><tr style={{ borderTop: `2px solid ${RED_DARK}` }}>
            <td colSpan={2} className="pt-2 font-bold">Amount Due</td>
            <td className="pt-2 text-right text-base font-bold" style={{ color: RED_DARK }}>{fmt(base + surcharge)}</td>
          </tr></tfoot>
        </table>

        {editable ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value as 'cash' | 'square')} className="w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm">
              <option value="cash">💵 Cash</option>
              <option value="square">💳 Square</option>
            </select>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#9AA5B4]">This invoice is paid and locked from further edits.</p>
        )}
      </div>

      {error && <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {editable && <button disabled={pending} onClick={save} className="rounded px-3 py-2 text-sm font-bold text-white" style={{ background: RED }}>💾 Save Changes</button>}
        <button disabled={pending} onClick={email} className="rounded bg-[#7C3AED] px-3 py-2 text-sm font-bold text-white">✉ Email to Customer</button>
        <button onClick={printDoc} className="rounded border border-[#E2DDD6] px-3 py-2 text-sm">🖨 Print / PDF</button>
        <button onClick={onClose} className="rounded border border-[#E2DDD6] px-3 py-2 text-sm">Close</button>
      </div>
    </Modal>
  )
}

// ═══════════════════════════ GRIEVANCES ═══════════════════════════

function GrievancesTab({ project, grievances, onChanged }: { project: Project; grievances: Grievance[]; onChanged: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [resolving, setResolving] = useState<Grievance | null>(null)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setShowAdd(true)} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          ＋ Log Grievance
        </button>
        <div className="text-sm text-[#4A5568]">{grievances.filter(g => g.status !== 'resolved').length} open</div>
      </div>

      {grievances.length === 0 && <div className="rounded-lg border border-[#E2DDD6] bg-white p-6 text-sm text-[#9AA5B4]">No grievances logged.</div>}

      {grievances.map(g => (
        <div key={g.id} className="mb-3 rounded-lg border border-[#E2DDD6] border-l-4 bg-white p-4" style={{ borderLeftColor: g.status === 'resolved' ? '#27AE60' : '#E53E3E' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={g.status === 'resolved' ? { background: '#D1FAE5', color: '#27AE60' } : { background: '#FEE2E2', color: '#E53E3E' }}>
              {g.status.replace('_', ' ').toUpperCase()}
            </span>
            {g.status !== 'resolved' && (
              <button onClick={() => setResolving(g)} className="rounded bg-[#27AE60] px-2 py-1 text-xs font-bold text-white">Mark Resolved</button>
            )}
          </div>
          <div className="mb-1 text-sm font-semibold">{g.title}</div>
          {g.description && <div className="mb-2 text-sm text-[#4A5568]">{g.description}</div>}
          {g.grievance_photos.length > 0 && (
            <div className="mb-2 flex gap-2">
              {g.grievance_photos.map(p => (
                <a key={p.id} href={p.photo_url} target="_blank" rel="noreferrer">
                  <img src={p.photo_url} alt={p.caption ?? ''} className="h-16 w-16 rounded object-cover" />
                </a>
              ))}
            </div>
          )}
          <div className="text-xs text-[#9AA5B4]">
            Logged {fmtDate(g.created_at)}
            {g.resolution_note && <> · Resolution: {g.resolution_note}</>}
          </div>
        </div>
      ))}

      {showAdd && <AddGrievanceModal project={project} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); onChanged() }} />}
      {resolving && <ResolveGrievanceModal grievance={resolving} onClose={() => setResolving(null)} onResolved={() => { setResolving(null); onChanged() }} />}
    </div>
  )
}

function AddGrievanceModal({ project, onClose, onCreated }: { project: Project; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!title.trim()) { setError('Title required'); return }
    setError('')
    startTransition(async () => {
      try {
        const urls: string[] = []
        if (file) {
          const fd = new FormData()
          fd.set('file', file)
          urls.push(await uploadGrievancePhoto(project.id, fd))
        }
        await createGrievance(project.id, title, description, urls)
        onCreated()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <Modal onClose={onClose} title="⚠️ Log Grievance">
      <label className="mb-1 block text-xs font-semibold">Title *</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What went wrong?"
        className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      <label className="mb-1 block text-xs font-semibold">Description</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
        className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      <label className="mb-1 block text-xs font-semibold">Photo (optional)</label>
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 w-full text-sm" />
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      <ModalActions onCancel={onClose} onConfirm={submit} confirmLabel="Log Grievance" pending={pending} danger />
    </Modal>
  )
}

function ResolveGrievanceModal({ grievance, onClose, onResolved }: { grievance: Grievance; onClose: () => void; onResolved: () => void }) {
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function submit() {
    setError('')
    startTransition(async () => {
      try { await resolveGrievance(grievance.id, note); onResolved() }
      catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <Modal onClose={onClose} title="✓ Resolve Grievance">
      <label className="mb-1 block text-xs font-semibold">Resolution note</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="How was this resolved?"
        className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      <ModalActions onCancel={onClose} onConfirm={submit} confirmLabel="Mark Resolved" pending={pending} />
    </Modal>
  )
}

// ═══════════════════════════ EMAIL ═══════════════════════════

function EmailTab({ project, emails, onChanged }: { project: Project; emails: ManualEmail[]; onChanged: () => void }) {
  const [showSend, setShowSend] = useState(false)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setShowSend(true)} className="rounded-md bg-[#0D9488] px-3 py-2 text-sm font-bold text-white">＋ Send Email</button>
        <div className="text-sm text-[#4A5568]">{emails.length} sent</div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#E2DDD6] bg-white">
        {emails.length === 0 && <div className="p-6 text-sm text-[#9AA5B4]">No emails sent yet.</div>}
        {emails.map(e => (
          <div key={e.id} className="flex justify-between border-b border-[#E2DDD6] p-3 text-sm last:border-0">
            <span><strong>{e.subject}</strong> → {e.to_email}</span>
            <span className="text-[#9AA5B4]">{fmtDate(e.sent_at)}</span>
          </div>
        ))}
      </div>
      {showSend && <SendEmailModal project={project} onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); onChanged() }} />}
    </div>
  )
}

const EMAIL_TEMPLATES = [
  { label: 'Quote Ready', subject: (p: Project) => `Your quote for ${p.name} is ready`, body: (p: Project) => `Hi ${p.customers?.name ?? ''},\n\nYour quote for ${p.name} is ready to view.\n\nThank you,\nCustom Elegant Blinds` },
  { label: 'Invoice Due Reminder', subject: (p: Project) => `Reminder: invoice due for ${p.name}`, body: (p: Project) => `Hi ${p.customers?.name ?? ''},\n\nThis is a reminder that you have an invoice due for ${p.name}.\n\nThank you,\nCustom Elegant Blinds` },
  { label: 'Payment Received', subject: (p: Project) => `Payment received — ${p.name}`, body: (p: Project) => `Hi ${p.customers?.name ?? ''},\n\nWe've received your payment for ${p.name}. Thank you!\n\nCustom Elegant Blinds` },
  { label: 'Grievance Update', subject: (p: Project) => `Update on your ${p.name} project`, body: (p: Project) => `Hi ${p.customers?.name ?? ''},\n\nWe wanted to give you an update regarding your recent concern on ${p.name}.\n\nCustom Elegant Blinds` },
  { label: 'Project Complete', subject: (p: Project) => `${p.name} is complete!`, body: (p: Project) => `Hi ${p.customers?.name ?? ''},\n\nYour project ${p.name} is now complete. Thank you for choosing Custom Elegant Blinds!` },
]

function SendEmailModal({ project, onClose, onSent }: { project: Project; onClose: () => void; onSent: () => void }) {
  const [templateIdx, setTemplateIdx] = useState(0)
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject(project))
  const [body, setBody] = useState(EMAIL_TEMPLATES[0].body(project))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function pickTemplate(idx: number) {
    setTemplateIdx(idx)
    setSubject(EMAIL_TEMPLATES[idx].subject(project))
    setBody(EMAIL_TEMPLATES[idx].body(project))
  }

  function submit() {
    setError('')
    startTransition(async () => {
      try { await sendManualEmail(project.id, project.customers?.email ?? project.email, subject, body); onSent() }
      catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <Modal onClose={onClose} title="✉️ Send Email" wide>
      <label className="mb-1 block text-xs font-semibold">To</label>
      <div className="mb-3 text-sm text-[#4A5568]">{project.customers?.email ?? project.email}</div>
      <label className="mb-1 block text-xs font-semibold">Template</label>
      <select value={templateIdx} onChange={e => pickTemplate(Number(e.target.value))} className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm">
        {EMAIL_TEMPLATES.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}
      </select>
      <label className="mb-1 block text-xs font-semibold">Subject</label>
      <input value={subject} onChange={e => setSubject(e.target.value)} className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      <label className="mb-1 block text-xs font-semibold">Body</label>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="mb-3 w-full rounded border border-[#E2DDD6] px-3 py-2 text-sm" />
      <p className="mb-3 text-xs text-[#9AA5B4]">Actual delivery via Resend isn't wired up yet — this logs the send for now.</p>
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      <ModalActions onCancel={onClose} onConfirm={submit} confirmLabel="Send" pending={pending} />
    </Modal>
  )
}

// ═══════════════════════════ SHARED MODAL SHELL ═══════════════════════════

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl ${wide ? 'w-[560px]' : 'w-[440px]'} max-w-[92vw]`} onClick={e => e.stopPropagation()}>
        {title && <h3 className="mb-4 font-serif text-base font-bold">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onConfirm, confirmLabel, pending, danger }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string; pending: boolean; danger?: boolean
}) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="rounded border border-[#E2DDD6] px-3 py-2 text-sm">Cancel</button>
      <button disabled={pending} onClick={onConfirm} className="rounded px-3 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: danger ? '#E53E3E' : RED }}>
        {pending ? 'Saving…' : confirmLabel}
      </button>
    </div>
  )
}
