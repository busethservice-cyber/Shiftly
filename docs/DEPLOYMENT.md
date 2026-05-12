# Shiftly MVP — deployment guide (Vercel + Supabase + GitHub)

This guide is for getting **Shiftly** online so June (or anyone) can open it in a browser from any PC using a normal web address.

**Stack**

- **GitHub** — source code
- **Vercel** — hosting the Next.js app
- **Supabase** — PostgreSQL database + email/password login (Auth)

**Important:** In production, set `NEXT_PUBLIC_USE_MOCK_DATA=false` so data is read/written in Supabase instead of the browser’s local demo mode.

---

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**.
3. Choose a **name** (e.g. `shiftly-mvp`), a **database password** (save it somewhere safe), and a **region** close to your users.
4. Wait until the project finishes provisioning.

You will use this project for:

- **Database** (tables below)
- **Authentication** (email + password users)

---

## 2. Tables and schema Shiftly expects

Shiftly’s TypeScript types live in `app/lib/dbTypes.ts`. The app talks to Supabase with the **anon** key and filters by **organization** = the logged-in user’s id (`auth.users.id`).

Run the SQL below once in Supabase:

**SQL Editor** → **New query** → paste → **Run**.

```sql
-- Extensions
create extension if not exists "pgcrypto";

-- 1) organizations (id = first admin’s auth user id, set on first login)
create table if not exists public.organizations (
  id uuid primary key,
  name text not null
);

-- 2) stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  employee_site_key text,
  is_active boolean not null default true
);

-- 3) employees
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('admin', 'employee')),
  name text not null,
  position_percent numeric not null default 100,
  contract_hours numeric not null default 37.5,
  is_active boolean not null default true
);

-- 4) shifts (calendar day + times; app maps to week/day internally)
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  day date not null,
  start_time time not null,
  end_time time not null,
  status text not null check (status in ('draft', 'published'))
);

-- 5) availability (single-day rows; app expands date ranges on write)
create table if not exists public.availability_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  reason text not null check (reason in ('fri', 'syk', 'annet'))
);

-- 6) employee requests (ansattportal / varsler flows)
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null check (type in ('fri', 'bytt', 'syk')),
  date date not null,
  message text,
  status text not null check (status in ('pending', 'approved', 'rejected'))
);

-- 7) settings (json document per organization — preferred shape)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  data jsonb
);

-- Helpful indexes
create index if not exists idx_stores_org on public.stores (organization_id);
create index if not exists idx_employees_org on public.employees (organization_id);
create index if not exists idx_shifts_store on public.shifts (store_id);
create index if not exists idx_availability_employee on public.availability_periods (employee_id);
create index if not exists idx_requests_employee on public.requests (employee_id);
```

### Row Level Security (RLS) — required for the browser client

Without policies, Supabase will block reads/writes. Run this **after** the tables exist:

```sql
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.availability_periods enable row level security;
alter table public.requests enable row level security;
alter table public.settings enable row level security;

-- One organization per user id (matches app/bootstrap in app/lib/auth.ts)
create policy "organizations_select_own"
  on public.organizations for select using (auth.uid() = id);
create policy "organizations_insert_own"
  on public.organizations for insert with check (auth.uid() = id);
create policy "organizations_update_own"
  on public.organizations for update using (auth.uid() = id);

-- Stores
create policy "stores_all_own_org"
  on public.stores for all using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- Employees
create policy "employees_all_own_org"
  on public.employees for all using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- Shifts (via store belonging to org)
create policy "shifts_select_own"
  on public.shifts for select using (
    store_id in (select id from public.stores where organization_id = auth.uid())
  );
create policy "shifts_insert_own"
  on public.shifts for insert with check (
    store_id in (select id from public.stores where organization_id = auth.uid())
  );
create policy "shifts_update_own"
  on public.shifts for update using (
    store_id in (select id from public.stores where organization_id = auth.uid())
  );
create policy "shifts_delete_own"
  on public.shifts for delete using (
    store_id in (select id from public.stores where organization_id = auth.uid())
  );

-- Availability
create policy "availability_all_own"
  on public.availability_periods for all using (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  ) with check (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  );

-- Requests
create policy "requests_all_own"
  on public.requests for all using (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  ) with check (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  );

-- Settings
create policy "settings_select_own"
  on public.settings for select using (organization_id = auth.uid());
create policy "settings_insert_own"
  on public.settings for insert with check (organization_id = auth.uid());
create policy "settings_update_own"
  on public.settings for update using (organization_id = auth.uid());
```

**MVP caveats (by design in this repo):**

- Some fields (e.g. weekday blocks, recurring weekly unavailability, multi-store assignment for one employee) use **localStorage** in the browser even in Supabase mode. Core **employees**, **stores**, **shifts**, **availability_periods** (date-based), **settings**, and **requests** are in Postgres.

---

## 3. Create the first admin user

Shiftly’s login screen only supports **sign-in** (not public self-registration). The app creates an **organization** row and, on first login, an **admin employee** linked to that user when no employees exist yet (`app/lib/auth.ts`).

**Steps:**

1. In Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter June’s **email** and a **strong password**.
3. For quick testing you can turn off email confirmation: **Authentication** → **Providers** → **Email** → disable **Confirm email** (turn it back on for real production).
4. After the user exists, June opens your deployed app at `/login`, signs in with that email/password.
5. On first successful login, Shiftly should:
   - Upsert a row in `organizations` with `id = user.id`
   - Insert an `employees` row with `role = 'admin'` if the org had no employees

June is then the **admin** for that organization (same id as her auth user).

---

## 4. Create a GitHub repository

1. On [https://github.com/new](https://github.com/new), create a repository (e.g. `shiftly`).
2. On your PC, in the folder that contains the `shiftly` Next.js project (the directory with `package.json` for the app):

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Shiftly MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR_ORG/shiftly.git
   git push -u origin main
   ```

Replace the URL with your real repo.

---

## 5. Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New…** → **Project** → import the **Shiftly** GitHub repo.
3. Set **Root Directory** to the folder that contains this app’s `package.json` (often the repo subfolder named `shiftly` if the monorepo has a parent folder).
4. Framework preset: **Next.js** (default).
5. Deploy. Vercel will assign a URL like `https://shiftly-xxx.vercel.app`.

Optional: **Settings** → **Domains** → add a custom domain (e.g. `shiftly.yourdomain.com`).

---

## 6. Environment variables on Vercel

In the Vercel project: **Settings** → **Environment Variables** (Production + Preview as needed):

| Name | Value | Notes |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project **URL** from Supabase **Settings** → **API** | Must start with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon public** key from same page | Safe for browser; RLS protects data |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` | **Must be exactly** `false` or the app stays in local demo mode (`app/lib/runtimeConfig.ts`) |

Redeploy after saving variables (**Deployments** → … on latest → **Redeploy**).

---

## 7. How to test login

1. Open `https://YOUR-VERCEL-URL/login`.
2. Sign in with the user you created in Supabase (**section 3**).
3. You should be redirected to `/` (home). If credentials are wrong, Supabase returns an error shown on the form.

**Supabase Auth URL configuration**

- **Authentication** → **URL configuration**  
  - **Site URL**: your Vercel URL (e.g. `https://shiftly-xxx.vercel.app`).  
  - **Redirect URLs**: add the same URL (and `http://localhost:3000` for local dev).

---

## 8. Verify employees, stores, and shifts persist

1. Log in as the admin user.
2. **Butikker**: create or edit a store → refresh the page → store should still be there.
3. **Ansatte**: add an employee → refresh → employee should remain.
4. **Planlegg**: add or move a shift → refresh → shift should remain.

Cross-check in Supabase **Table Editor**: rows appear in `stores`, `employees`, `shifts` with `organization_id` / `store_id` / `employee_id` consistent with your actions.

---

## 9. Common errors and fixes

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| `Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY` | Env vars not set on Vercel or typo in names | Add both in Vercel, redeploy |
| App works but data never saves / resets on refresh | Still in mock mode | Set `NEXT_PUBLIC_USE_MOCK_DATA` to **`false`** (exact string), redeploy |
| `new row violates row-level security policy` | RLS enabled but policies missing/wrong | Re-run the RLS SQL in **section 2**; confirm policies exist in **Authentication** → **Policies** (or Table editor → RLS) |
| `Invalid login credentials` | Wrong password or user not created | Reset password in Supabase **Authentication** → **Users** |
| Login succeeds but empty data / errors in console | Org or employees not bootstrapped | Check `organizations` and `employees` in Table Editor; sign out and sign in again to re-run bootstrap, or insert org row manually with `id = user’s uuid` |
| `Failed to fetch` / CORS | Rare with Vercel + Supabase | Confirm `NEXT_PUBLIC_SUPABASE_URL` is the Supabase **project** URL, not a typo |
| Email never arrives | Confirmation still on | Disable **Confirm email** for testing or use Supabase “Confirm user” in dashboard |

---

## Quick checklist

- [ ] Supabase project created  
- [ ] Schema + RLS SQL applied  
- [ ] Auth user created for June (or first admin)  
- [ ] GitHub repo pushed  
- [ ] Vercel project linked; root directory correct  
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_USE_MOCK_DATA=false` set  
- [ ] Supabase **Site URL** + redirects include Vercel URL  
- [ ] Login tested; store/employee/shift survive a full page refresh  

You’re done when June can use the Vercel URL from any PC and see the same data after refresh.
