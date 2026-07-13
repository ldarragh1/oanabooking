-- Homeopathic Clinic Dublin — booking system schema.
-- Run this in the Supabase SQL editor (or via `supabase db push`) once
-- per project. All access goes through Edge Functions using the service
-- role key, so RLS is enabled with no public policies — the tables are
-- unreachable directly from the browser.

create table clients (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text not null,
  dob date,
  address text,
  since date not null default current_date,
  visits int not null default 0,
  last_visit date,
  color text,
  created_at timestamptz not null default now()
);
create unique index clients_email_key on clients (lower(email));

create table client_notes (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  note_date date not null default current_date,
  body text not null,
  created_at timestamptz not null default now()
);
create index client_notes_client_idx on client_notes (client_id);

create table appointments (
  id bigint generated always as identity primary key,
  client_id bigint references clients(id) on delete set null,
  service_id int not null,
  appt_date date not null,
  appt_time time not null,
  duration_min int not null,
  mode text not null check (mode in ('online','in-person')),
  pay_method text check (pay_method in ('stripe','in-person')),
  pay_status text not null default 'unpaid' check (pay_status in ('paid','unpaid')),
  status text not null default 'confirmed' check (status in ('confirmed','pending','completed','cancelled','noshow','blocked')),
  source text not null default 'online' check (source in ('online','admin')),
  notes text,
  stripe_session_id text,
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index appointments_date_idx on appointments (appt_date, appt_time);
create index appointments_reminder_idx on appointments (status, reminder_sent, appt_date, appt_time);
create unique index appointments_stripe_session_key on appointments (stripe_session_id) where stripe_session_id is not null;

alter table clients enable row level security;
alter table client_notes enable row level security;
alter table appointments enable row level security;
-- Intentionally no policies: browsers use the anon key, which has zero
-- access under RLS with no policies defined. All reads/writes happen
-- inside Edge Functions using the service role key (server-side only).
