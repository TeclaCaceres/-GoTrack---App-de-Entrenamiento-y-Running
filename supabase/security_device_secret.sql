-- ════════════════════════════════════════════════════════════════════════════
-- GoTrack — Cierre del "modo dispositivo" (secreto por instalación)
-- Ejecutalo UNA VEZ en:  Supabase → SQL Editor → New query → Run
-- (debe correrse DESPUÉS de schema.sql y auth.sql)
--
-- Por qué: la anon key es pública (viaja en el app y en el repo público).
-- Sin esto, cualquiera con esa key podía LEER y BORRAR el historial que todavía
-- no está ligado a una cuenta (modo dispositivo). Este script lo cierra:
--   · Cada instalación tiene un secret propio (device_secret = device_id).
--   · La app lo manda en el header "x-device-secret" en cada request.
--   · RLS solo deja ver/insertar/modificar/borrar una fila de dispositivo
--     si el secret del header coincide con el de la fila.
--   · Las filas con user_id siguen siendo exclusivas del usuario (auth.uid()).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Columna de secret por instalación
alter table public.runs add column if not exists device_secret text;

-- 2) Backfill: las filas actuales heredan el secret de su device_id
--    (la app conoce ese id desde el primer arranque, así que sigue pudiendo
--    acceder a su propio historial sin pérdida de datos)
update public.runs set device_secret = device_id where device_secret is null;

-- 3) Sacamos las políticas "por usuario" anteriores
drop policy if exists "runs_user_select" on public.runs;
drop policy if exists "runs_user_insert" on public.runs;
drop policy if exists "runs_user_update" on public.runs;
drop policy if exists "runs_user_delete" on public.runs;

-- 4) Nuevas políticas: auth del usuario O secret del dispositivo
create policy "runs_sec_select" on public.runs
  for select
  using (
    user_id = (auth.uid())::text
    or (
      user_id is null
      and device_secret = nullif(current_setting('request.headers', true)::json ->> 'x-device-secret', '')
    )
  );

create policy "runs_sec_insert" on public.runs
  for insert
  with check (
    (auth.uid() is not null and user_id = (auth.uid())::text)
    or (
      user_id is null
      and device_secret = nullif(current_setting('request.headers', true)::json ->> 'x-device-secret', '')
    )
  );

create policy "runs_sec_update" on public.runs
  for update
  using (
    user_id = (auth.uid())::text
    or (
      user_id is null
      and device_secret = nullif(current_setting('request.headers', true)::json ->> 'x-device-secret', '')
    )
  );

create policy "runs_sec_delete" on public.runs
  for delete
  using (
    user_id = (auth.uid())::text
    or (
      user_id is null
      and device_secret = nullif(current_setting('request.headers', true)::json ->> 'x-device-secret', '')
    )
  );

-- 5) Índice para buscar filas de dispositivo por secret
create index if not exists runs_device_secret_idx on public.runs (device_secret, date desc);