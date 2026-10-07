# GoTrack — Pulse Performance 🏃

App de entrenamiento y running con identidad **Pulse Performance**. Track de carreras con **mapa GPS real**, métricas, planes de entrenamiento y **respaldo en la nube (Supabase)**.

## 📱 Descargar la app (Android)

Podés instalar el **APK** sobre la versión que ya tenés (mismo firmado, no hace falta desinstalar):

👉 [Descargar APK de GoTrack](https://expo.dev/artifacts/eas/zFI6li87Hsji1h01ZwjJdf7kvhkrL3kX2Ki4V9LmDN8.apk)

> Si el instalador avisa "app not installed", desinstalá la anterior e instalá esta (tu historial se restaura solo desde la nube).

## ✨ Características

- 🗺️ **Mapa GPS en vivo**: ruta dibujada sobre mapa real (OpenStreetMap) mientras corrés, con ritmo y distancia. Funciona incluso sin datos (GPS offline).
- ⏱️ **Entrenamiento**: cuenta regresiva configurable (0/3/5/10 s), pantalla bloqueada, ritmo por voz, pasos y sentido/detectado automático.
- 🎯 **Metas editables**: DISTANCIA / RITMO / FRECUENCIA, cada una se edita con su modal.
- 📊 **Análisis y plan de entrenamiento**: barras de km por día, mayor distancia, mejor ritmo, récord de la semana y planes 5K/10K/21K por nivel.
- 📈 **Novedades en Inicio**: carousel horizontal (Comunidad próximamente).
- 👤 **Perfil con avatar**: emoji o foto desde la galería.
- 🌤️ **Respaldo en la nube (Supabase)**: el historial se sincroniza automáticamente; con **login opcional por email** el historial te sigue en cualquier teléfono.
- 🎬 **Intros + Precarga**: onboarding swipeable la primera vez y pantalla de arranque con identidad Pulse.
- 📤 **Exportar GPX** para compartir la ruta.

## 🛠️ Arquitectura

Monorepo con dos paquetes:

```
├── app-mobile/      # App React Native + Expo (SDK 57), JavaScript, App.js single-file
├── gotrack-backend/ # API REST Node.js + Express (server.js, puerto 3000) — futura extensión
└── supabase/        # Esquema SQL y políticas del respaldo en la nube
```

- **Estado local**: Expo SQLite + AsyncStorage (offline-first).
- **Mapa**: WebView con Leaflet/OpenStreetMap (tiles solo con datos; GPS siempre).
- **Nube**: Supabase — tabla `runs`, RLS por usuario (`supabase/auth.sql`) + modo dispositivo sin sesión.
- **Frontend**: React Native + Material (react-native-paper), dark-first (`#0E0F0C` / lima `#D7FE47`).

## 🚀 Build del APK

```bash
cd app-mobile
npx eas-cli@latest build --platform android --profile preview
```

## 🔒 Seguridad

El repo es **público** a propósito (portfolio), así que la protección vive en la nube:

- **Anon key pública por diseño** (Supabase). No es un secreto: lo que sí es secreto son las *service role keys* (nunca commiteadas) y la contraseña del proyecto.
- **RLS por usuario**: las carreras con `user_id` solo las ve su dueño (`auth.uid()`).
- **RLS con secreto por dispositivo**: sin cuenta, cada instalación tiene un `device_secret` que la app manda en el header `x-device-secret`. Con la anon key sola no se puede leer, insertar, modificar ni borrar nada del modo dispositivo (`supabase/security_device_secret.sql`).
- El backend Express local (`gotrack-backend`) queda **fuera de internet**: si algún día se despliega, requiere API key + CORS restringido primero.