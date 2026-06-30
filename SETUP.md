# Custom Elegant Blinds — Setup Guide
## Stack: Next.js 14 · Supabase · Vercel · Resend

---

## STEP 1 — Supabase (Database + Auth)

1. Go to https://supabase.com → "New project"
2. Name: `custom-elegant-blinds` · Choose a strong DB password · Region: West US
3. Wait ~2 minutes for project to spin up
4. Go to **SQL Editor** → click **New Query**
5. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
6. Paste and click **Run** — this creates all tables, RLS policies, and seed data
7. Go to **Settings → API** and copy:
   - `Project URL` → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → paste as `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!
8. Go to **Authentication → Settings**:
   - Site URL: `http://localhost:3000` (update to your Vercel URL after deploy)
   - Disable email confirmation for now (enable later in production)

### Create Admin User in Supabase
1. Go to **Authentication → Users** → "Invite user"
2. Email: `admin@ceblinds.click` · set a strong password
3. After user is created, go to **SQL Editor** and run:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@ceblinds.click';
```

---

## STEP 2 — Local Development

```bash
# In your Codespace terminal:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install dependencies
npm install

# Copy env file and fill in your Supabase keys
cp .env.example .env.local
# Edit .env.local with your actual keys

# Run development server
npm run dev
# Open: http://localhost:3000
```

---

## STEP 3 — Vercel (Free Hosting)

1. Go to https://vercel.com → "New Project"
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Add Environment Variables (same as your .env.local):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` (after Step 4)
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL (e.g. `https://ceblinds.click`)
5. Click **Deploy** — takes ~2 minutes
6. Go back to Supabase → Auth Settings → update Site URL to your Vercel URL

### Custom Domain (ceblinds.click)
1. In Vercel project → Settings → Domains → Add `ceblinds.click`
2. Follow DNS instructions (add CNAME to your domain registrar)
3. SSL certificate is automatic and free

---

## STEP 4 — Resend (Email)

1. Go to https://resend.com → free account
2. Add your domain: `ceblinds.click` → follow DNS verification
3. API Keys → Create API Key → copy to `RESEND_API_KEY`
4. Set `EMAIL_FROM=quotes@ceblinds.click`

---

## STEP 5 — Supabase Storage (Gallery Images)

1. In Supabase → Storage → "New bucket"
2. Name: `gallery` · Make it **public**
3. Name: `catalog` · Make it **public**
4. RLS is already set (admin can upload, everyone can view)

---

## PAGE MAP

| URL | Who | What |
|-----|-----|------|
| `/` | Anyone | Redirects to login or dashboard |
| `/auth/login` | Anyone | Login page |
| `/auth/register` | Anyone | Customer registration |
| `/customer` | Customer | Project list dashboard |
| `/customer/project/[id]` | Customer | View quote spreadsheet |
| `/admin` | Admin | Universal admin panel |
| `/admin/pricing` | Admin | My Purchase tab (costs/factors) |
| `/admin/customers` | Admin | Manage customers |
| `/admin/project/[id]` | Admin | Edit project + push pricing |
| `/admin/gallery` | Admin | Upload gallery images |
| `/quote/[id]` | Anyone with link | Public quote view (email link) |

---

## WHAT'S NEXT (Phase 2)

- [ ] Stripe payment gateway (30% deposit)
- [ ] Invoice PDF generation
- [ ] Customer "Confirm Quote" button
- [ ] Gallery pages with product filtering
- [ ] Email tracking (viewed/not viewed)
- [ ] Admin chat with customer per project
- [ ] Tax year reports
- [ ] Mobile app (Expo/React Native)

---

## COSTS (all free to start)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Supabase | 500MB DB, 1GB storage, 50k MAU | $25/mo |
| Vercel | Unlimited deploys, 100GB bandwidth | $20/mo |
| Resend | 3,000 emails/mo | $20/mo |
| Stripe | Free to set up | 2.9% + 30¢/transaction |
| GitHub | Unlimited public repos | Free |

**Total cost to launch: $0**

---

## DNS RECORDS FOR ceblinds.click

Add all of these in your domain registrar's DNS manager (GoDaddy, Namecheap, Cloudflare, etc.)

---

### STEP A — Vercel (Hosting)

These point your domain to Vercel. Add both:

| Type | Name/Host | Value | TTL |
|------|-----------|-------|-----|
| A | @ (or blank) | 76.76.21.21 | 3600 |
| CNAME | www | cname.vercel-dns.com | 3600 |

> After adding these, go to Vercel → Project → Settings → Domains → add `ceblinds.click` and `www.ceblinds.click`. Vercel will auto-issue your free SSL certificate.

---

### STEP B — Resend (Email deliverability)

**⚠️ Important:** Steps B1–B3 use values Resend generates uniquely for your account.
Go to https://resend.com → Domains → Add Domain → type `ceblinds.click` → Resend will show you the exact values. Match them to the record types below.

#### B1 — SPF (tells mail servers Resend is allowed to send for you)

| Type | Name/Host | Value | TTL |
|------|-----------|-------|-----|
| TXT | @ (or blank) | `v=spf1 include:_spf.resend.com -all` | 3600 |

> This is the same for every Resend customer — you can add this one right now without waiting for Resend.

#### B2 — DKIM (3 CNAME records — values come from Resend dashboard)

Resend will show you 3 CNAME records. They will look exactly like this format — copy the actual values from your Resend dashboard:

| Type | Name/Host | Value (from Resend dashboard) | TTL |
|------|-----------|-------------------------------|-----|
| CNAME | resend._domainkey.ceblinds.click | resend._domainkey.resend.com | 3600 |
| CNAME | *(2nd key Resend shows you)* | *(value Resend shows you)* | 3600 |
| CNAME | *(3rd key Resend shows you)* | *(value Resend shows you)* | 3600 |

> **GoDaddy note:** Enter only the part before `.ceblinds.click` in the Name field.
> For example enter `resend._domainkey` not `resend._domainkey.ceblinds.click`

#### B3 — MX for bounce handling (from Resend dashboard)

| Type | Name/Host | Value (from Resend dashboard) | Priority | TTL |
|------|-----------|-------------------------------|----------|-----|
| MX | send.ceblinds.click | *(value Resend shows you)* | 10 | 3600 |

#### B4 — DMARC (add this immediately — same for everyone)

Start with `p=none` (monitor only). After 2–4 weeks of confirmed delivery, upgrade to `p=quarantine`.

| Type | Name/Host | Value | TTL |
|------|-----------|-------|-----|
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@ceblinds.click; adkim=r; aspf=r;` | 3600 |

> `rua=mailto:dmarc@ceblinds.click` sends you weekly reports showing if anyone is spoofing your domain.
> Once you see clean reports for 2–4 weeks, change `p=none` to `p=quarantine` for stronger protection.

---

### STEP C — After 24–48 hours, verify everything

Go back to Resend → Domains → your domain → click **Check DNS**.
All records should show green checkmarks.

You can also verify yourself at:
- https://mxtoolbox.com/SuperTool.aspx → type `ceblinds.click` → check SPF, DKIM, DMARC
- https://mail-tester.com → send a test email → get a score (aim for 9+/10)

---

### COMPLETE DNS RECORD SUMMARY

Once everything is added, your full DNS table for `ceblinds.click` should look like this:

```
TYPE    NAME                              VALUE
─────────────────────────────────────────────────────────────────────────
A       @                                 76.76.21.21
CNAME   www                               cname.vercel-dns.com
TXT     @                                 v=spf1 include:_spf.resend.com -all
CNAME   resend._domainkey                 resend._domainkey.resend.com
CNAME   [key2 from Resend]                [value from Resend]
CNAME   [key3 from Resend]                [value from Resend]
MX      send                              [value from Resend] (priority 10)
TXT     _dmarc                            v=DMARC1; p=none; rua=mailto:dmarc@ceblinds.click; adkim=r; aspf=r;
```

---

### TROUBLESHOOTING

**Records not verifying after 24 hours?**
- GoDaddy/Namecheap: make sure you did NOT include `.ceblinds.click` at the end of the Name field
- Cloudflare: set all DNS records to **DNS only** (grey cloud), not proxied (orange cloud) — especially for DKIM CNAMEs
- Only one SPF TXT record allowed per domain — if you already have one, merge them: `v=spf1 include:_spf.resend.com include:otherprovider.com -all`

**Emails still going to spam?**
1. Check your score at mail-tester.com (send from your app, not manually)
2. Make sure `EMAIL_FROM` in `.env.local` is `quotes@ceblinds.click` (matches your authenticated domain)
3. Upgrade DMARC to `p=quarantine` once reports confirm clean sending

**`.click` TLD extra note:**
Some aggressive spam filters flag `.click` domains slightly more than `.com`. Mitigate this by:
- Making sure all 3 DKIM records are verified (green) in Resend
- Sending a welcome email to yourself first to warm up the domain
- Starting with a low volume (< 100 emails/day in the first week)
