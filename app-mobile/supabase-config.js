// ─────────────────────────────────────────────────────────────────────────────
// GoTrack × Supabase — configuración del backend en la nube
//
// Para activar el respaldo en la nube:
//   1. Creá un proyecto gratis en https://supabase.com (o usá el tuyo).
//   2. En Project Settings → API, copiá el "Project URL" y la "anon public key".
//   3. Pegá los dos valores abajo (reemplazá los textitos que empiezan con "TU-").
//   4. Ejecutá el archivo supabase/schema.sql (raíz del repo) en el SQL Editor.
//
// La anon key es pública por diseño (va en el cliente). No es un secreto.
// Si dejás los valores en "TU-", la app detecta que no está configurado y
// funciona 100% en modo local (sin errores).
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = 'https://ekngmjzfxglrcthgnlvg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbmdtanpmeGdscmN0aGdubHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDE3NTcsImV4cCI6MjEwNjk3Nzc1N30.AOdfrDPk9iNnVFW8DOkLWfFYgdHchQy3a9smCoWlznI';