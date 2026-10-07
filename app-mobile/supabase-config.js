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

export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-PUBLIC-KEY';