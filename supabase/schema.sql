-- ════════════════════════════════════════════════════════════════════════════
-- GoTrack — Esquema Supabase
-- Ejecutalo una sola vez en:  Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════════════════

-- Historial de carreras (misma forma que guarda la app en SQLite)
create table if not exists public.runs (
  id         text primary key,
  date       text not null,
  duration   integer,
  surface    text,
  feeling    text,
  notes      text,
  steps      integer,
  locations  text,             -- JSON con la ruta [lat, lng]
  device_id  text not null default 'local',   -- identifica el celular
  synced_at  timestamptz default now()
);

create index if not exists runs_device_date_idx on public.runs (device_id, date desc);

alter table public.runs enable row level security;

-- MVP "por arriba": políticas abiertas para la anon key del cliente.
-- Cuando haya usuarios con login, filtrar por auth.uid().
create policy "runs_public_insert" on public.runs for insert with check (true);
create policy "runs_public_select" on public.runs for select using (true);
create policy "runs_public_update" on public.runs for update using (true);
create policy "runs_public_delete" on public.runs for delete using (true);