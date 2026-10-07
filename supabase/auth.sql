-- ════════════════════════════════════════════════════════════════════════════
-- GoTrack — Login opcional (Supabase Auth)
-- Ejecutalo UNA VEZ en:  Supabase → SQL Editor → New query → Run
-- (debe correrse después de schema.sql)
--
-- Qué cambia:
--  · Agrega la columna user_id a la tabla runs.
--  · Reemplaza las políticas abiertas por políticas por usuario:
--      - Con sesión iniciada: solo se ven/editan las carreras de ese usuario.
--      - Sin sesión (modo dispositivo): carreras con user_id nulo, igual que antes.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.runs add column if not exists user_id text;

-- Índice para buscar el historial por usuario rápido
create index if not exists runs_user_date_idx on public.runs (user_id, date desc);

-- ── Sacamos las políticas abiertas del MVP ──
drop policy if exists "runs_public_insert" on public.runs;
drop policy if exists "runs_public_select" on public.runs;
drop policy if exists "runs_public_update" on public.runs;
drop policy if exists "runs_public_delete" on public.runs;

-- ── Políticas por usuario (auth.uid() es el id de la sesión) ──
-- SELECT: carreras mías (user_id = mi id) + carreras de dispositivo sin dueño (modo local).
create policy "runs_user_select" on public.runs
  for select
  using (user_id is null or user_id = (auth.uid())::text);

-- INSERT: permitido sin sesión (user_id nulo, modo dispositivo) o con mi id cuando estoy logueado.
create policy "runs_user_insert" on public.runs
  for insert
  with check (
    user_id is null
    or (auth.uid() is not null and user_id = (auth.uid())::text)
  );

-- UPDATE / DELETE: solo mis carreras o las de dispositivo sin dueño.
create policy "runs_user_update" on public.runs
  for update
  using (user_id is null or user_id = (auth.uid())::text);

create policy "runs_user_delete" on public.runs
  for delete
  using (user_id is null or user_id = (auth.uid())::text);