-- Run in Supabase SQL Editor (production) before using partial-day absence persistence.

-- Expand reason enum
alter table public.availability_periods drop constraint if exists availability_periods_reason_check;
alter table public.availability_periods
  add constraint availability_periods_reason_check
  check (reason in ('fri', 'ferie', 'syk', 'skole', 'annet'));

-- Partial-day times + grouping + note
alter table public.availability_periods
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists note text,
  add column if not exists period_group_id uuid;

create index if not exists idx_availability_employee_date
  on public.availability_periods (employee_id, date);

-- Recurring weekly unavailability (replaces localStorage in production)
create table if not exists public.recurring_availability_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  weekday int not null check (weekday >= 0 and weekday <= 6),
  start_time time,
  end_time time,
  reason text,
  valid_from date,
  valid_to date,
  note text
);

create index if not exists idx_recurring_availability_employee
  on public.recurring_availability_periods (employee_id);

alter table public.recurring_availability_periods enable row level security;

create policy "recurring_availability_all_own"
  on public.recurring_availability_periods for all using (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  ) with check (
    employee_id in (select id from public.employees where organization_id = auth.uid())
  );
