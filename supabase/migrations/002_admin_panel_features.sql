-- ═══════════════════════════════════════════════════════════════
-- Migration 002 — Admin Panel: Invoices, Payments, Grievances
-- Run this in Supabase SQL Editor (after 001_initial_schema.sql)
-- ═══════════════════════════════════════════════════════════════

-- ─── PAYMENT STATUS on projects (simple % + paid toggle) ─────
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deposit_pct NUMERIC(5,2) DEFAULT 30;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS full_payment_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS full_payment_paid_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2);

-- ─── GRIEVANCES (issues/notes per project, can attach photos) ──
CREATE TABLE IF NOT EXISTS public.grievances (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.grievance_photos (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grievance_id  UUID REFERENCES public.grievances(id) ON DELETE CASCADE NOT NULL,
  photo_url     TEXT NOT NULL,
  caption       TEXT,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MANUAL EMAIL LOG (direct emails sent from admin panel) ────
CREATE TABLE IF NOT EXISTS public.manual_emails (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  sent_by     UUID REFERENCES public.profiles(id),
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS for new tables ──────────────────────────────────────
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grievances_admin" ON public.grievances FOR ALL USING (public.is_admin());
CREATE POLICY "grievances_customer_read" ON public.grievances FOR SELECT
  USING (project_id IN (SELECT p.id FROM public.projects p JOIN public.customers c ON p.customer_id=c.id WHERE c.profile_id=auth.uid()));

CREATE POLICY "grievance_photos_admin" ON public.grievance_photos FOR ALL USING (public.is_admin());
CREATE POLICY "grievance_photos_customer_read" ON public.grievance_photos FOR SELECT
  USING (grievance_id IN (SELECT g.id FROM public.grievances g
    JOIN public.projects p ON g.project_id=p.id
    JOIN public.customers c ON p.customer_id=c.id WHERE c.profile_id=auth.uid()));

CREATE POLICY "manual_emails_admin" ON public.manual_emails FOR ALL USING (public.is_admin());

-- ─── Storage bucket for grievance photos ────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('grievance-photos', 'grievance-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "grievance_photos_upload_admin" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'grievance-photos' AND public.is_admin());
CREATE POLICY "grievance_photos_read_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'grievance-photos');
