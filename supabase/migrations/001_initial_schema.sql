-- ═══════════════════════════════════════════════════════════════
-- Custom Elegant Blinds — Initial Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  full_name   TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CUSTOMERS ──────────────────────────────────────────────
CREATE TABLE public.customers (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','pending','inactive')),
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROJECTS ───────────────────────────────────────────────
CREATE TABLE public.projects (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id   UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  email         TEXT NOT NULL,
  phone         TEXT,
  property_type TEXT DEFAULT 'Residential – Single Family',
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','confirmed','invoiced','completed','cancelled')),
  viewed_at     TIMESTAMPTZ,
  confirmed_at  TIMESTAMPTZ,
  is_pushed     BOOLEAN DEFAULT FALSE,
  pushed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROJECT ROWS ────────────────────────────────────────────
CREATE TABLE public.project_rows (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  is_section    BOOLEAN DEFAULT FALSE,
  section_name  TEXT,
  blind_type    TEXT,
  control       TEXT,
  location      TEXT,
  fabric        TEXT,
  valance       TEXT DEFAULT '—',
  bottom_rail   TEXT DEFAULT '—',
  mount         TEXT DEFAULT 'Inside',
  width_in      NUMERIC(8,2),
  height_in     NUMERIC(8,2),
  qty           INTEGER DEFAULT 1,
  remark        TEXT,
  cost_override   NUMERIC(10,2),
  factor_override NUMERIC(6,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCTS ────────────────────────────────────────────────
CREATE TABLE public.products (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  my_cost_per_sqm  NUMERIC(10,2) DEFAULT 16,
  factor           NUMERIC(6,2) DEFAULT 5,
  sort_order       INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MOTORS ──────────────────────────────────────────────────
CREATE TABLE public.motors (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  my_cost_per_unit  NUMERIC(10,2) DEFAULT 0,
  factor            NUMERIC(6,2) DEFAULT 1,
  sort_order        INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROJECT CONFIG ──────────────────────────────────────────
CREATE TABLE public.project_config (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  tax_pct         NUMERIC(5,2) DEFAULT 10,
  shipping_pct    NUMERIC(5,2) DEFAULT 18,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_reason TEXT,
  installation    NUMERIC(10,2) DEFAULT 500,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CUSTOM FEE LINES ────────────────────────────────────────
CREATE TABLE public.project_fees (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  label       TEXT NOT NULL,
  fee_type    TEXT DEFAULT 'flat' CHECK (fee_type IN ('flat','pct')),
  value       NUMERIC(10,2) DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES ────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  invoice_number  TEXT UNIQUE,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','paid')),
  total_amount    NUMERIC(12,2),
  deposit_pct     NUMERIC(5,2) DEFAULT 30,
  deposit_amount  NUMERIC(12,2),
  deposit_paid_at TIMESTAMPTZ,
  fully_paid_at   TIMESTAMPTZ,
  due_date        DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS ────────────────────────────────────────────────
CREATE TABLE public.payments (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id       UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  payment_method   TEXT,
  stripe_payment_id TEXT,
  notes            TEXT,
  paid_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GALLERY ─────────────────────────────────────────────────
CREATE TABLE public.gallery (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT,
  description TEXT,
  image_url   TEXT NOT NULL,
  category    TEXT,
  room_type   TEXT,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sort_order  INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DISCOUNT LOG ────────────────────────────────────────────
CREATE TABLE public.discount_log (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id  UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  discount_pct NUMERIC(5,2),
  amount_saved NUMERIC(12,2),
  reason       TEXT,
  applied_by   UUID REFERENCES public.profiles(id),
  applied_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMAIL EVENTS ────────────────────────────────────────────
CREATE TABLE public.email_events (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type  TEXT CHECK (event_type IN ('quote_sent','viewed','reminder','invoice_sent')),
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  viewed_at   TIMESTAMPTZ,
  email_to    TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_fees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motors         ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles
CREATE POLICY "own_profile"    ON public.profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "admin_profiles" ON public.profiles FOR ALL USING (public.is_admin());
-- Customers
CREATE POLICY "customer_own"   ON public.customers FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "admin_customers" ON public.customers FOR ALL USING (public.is_admin());
-- Projects
CREATE POLICY "project_customer" ON public.projects FOR SELECT
  USING (customer_id IN (SELECT id FROM public.customers WHERE profile_id = auth.uid()));
CREATE POLICY "project_admin" ON public.projects FOR ALL USING (public.is_admin());
-- Project rows
CREATE POLICY "rows_customer" ON public.project_rows FOR SELECT
  USING (project_id IN (SELECT p.id FROM public.projects p JOIN public.customers c ON p.customer_id = c.id WHERE c.profile_id = auth.uid()));
CREATE POLICY "rows_admin" ON public.project_rows FOR ALL USING (public.is_admin());
-- Config & fees
CREATE POLICY "config_customer" ON public.project_config FOR SELECT
  USING (project_id IN (SELECT p.id FROM public.projects p JOIN public.customers c ON p.customer_id = c.id WHERE c.profile_id = auth.uid()));
CREATE POLICY "config_admin" ON public.project_config FOR ALL USING (public.is_admin());
CREATE POLICY "fees_customer" ON public.project_fees FOR SELECT
  USING (project_id IN (SELECT p.id FROM public.projects p JOIN public.customers c ON p.customer_id = c.id WHERE c.profile_id = auth.uid()));
CREATE POLICY "fees_admin" ON public.project_fees FOR ALL USING (public.is_admin());
-- Invoices & payments
CREATE POLICY "inv_customer" ON public.invoices FOR SELECT
  USING (project_id IN (SELECT p.id FROM public.projects p JOIN public.customers c ON p.customer_id = c.id WHERE c.profile_id = auth.uid()));
CREATE POLICY "inv_admin"     ON public.invoices FOR ALL USING (public.is_admin());
CREATE POLICY "pay_admin"     ON public.payments FOR ALL USING (public.is_admin());
-- Gallery: public read
CREATE POLICY "gallery_read"  ON public.gallery FOR SELECT USING (TRUE);
CREATE POLICY "gallery_admin" ON public.gallery FOR ALL USING (public.is_admin());
-- Products & motors: public read
CREATE POLICY "prod_read"  ON public.products FOR SELECT USING (TRUE);
CREATE POLICY "prod_admin" ON public.products FOR ALL USING (public.is_admin());
CREATE POLICY "motor_read" ON public.motors FOR SELECT USING (TRUE);
CREATE POLICY "motor_admin" ON public.motors FOR ALL USING (public.is_admin());
-- Admin-only tables
CREATE POLICY "disc_admin"  ON public.discount_log FOR ALL USING (public.is_admin());
CREATE POLICY "email_admin" ON public.email_events FOR ALL USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.products (name, my_cost_per_sqm, factor, sort_order) VALUES
  ('Zebra Blinds',       16,  5,    1),
  ('HoneyComb',          26,  2.89, 2),
  ('Wooden Flux',        10,  5,    3),
  ('Dream Curtains',     16,  4.7,  4),
  ('Roller',             7,   9,    5),
  ('Motorized Roller',   7,   9,    6),
  ('Double Roller',      14,  9,    7);

INSERT INTO public.motors (name, my_cost_per_unit, factor, sort_order) VALUES
  ('None',                0,   1,    1),
  ('Cordless',            7,   1.43, 2),
  ('Motor',               45,  2.5,  3),
  ('Electric Motor',      35,  3,    4),
  ('Dream Curtain Motor', 120, 1.5,  5),
  ('Left Side Chain',     0,   1,    6),
  ('Right Side Chain',    0,   1,    7),
  ('Alexa Hub',           40,  2,    8),
  ('Remote',              8,   2,    9),
  ('Outdoor Motor',       60,  2.5,  10);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
          COALESCE(NEW.raw_user_meta_data->>'role', 'customer'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'CEB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_projects_upd    BEFORE UPDATE ON public.projects    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER t_customers_upd   BEFORE UPDATE ON public.customers   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER t_config_upd      BEFORE UPDATE ON public.project_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER t_invoices_upd    BEFORE UPDATE ON public.invoices    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
