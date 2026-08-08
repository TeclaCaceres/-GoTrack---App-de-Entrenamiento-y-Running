## 📱 Descarga Directa (Android)

Podés descargar e instalar el paquete listo para usar (**APK**) en tu dispositivo Android directamente desde Expo Build:

👉 **[📲 Descargar APK de GoTrack (Android)](https://expo.dev/artifacts/eas/sLgH2X3yK1mP4vL9-example.apk)

## 🛠️ Arquitectura del Proyecto

El proyecto está estructurado como un **Monorepo** que contiene tanto el cliente móvil como el backend:

/ -GoTrack---App-de-Entrenamiento-y-Running
├── 📁 app-mobile/        # Aplicación Mobile (React Native + Expo)
├── 📁 gotrack-backend/   # Servidor API REST (Node.js / Express)
└── 📄 README.md          # Documentación general del repositorio



🚀 Características Principales
📍 Monitoreo GPS: Registro de rutas y ritmo de carrera en tiempo real.

📊 Métricas de Entrenamiento: Cálculo de distancias, tiempos y calorías.

🔐 Autenticación: Registro e inicio de sesión de usuarios de forma segura.

💾 Sincronización: Persistencia local y sincronización con el servidor backend.

💻 Tecnologías Utilizadas
Mobile (/app-mobile)
Framework: React Native con Expo workflow.

Lenguaje: JavaScript / TypeScript.

Estado & Almacenamiento: AsyncStorage / Expo SQLite.

Ubicación: Expo Location.

Backend (/gotrack-backend)
Entorno: Node.js.

Framework Web: Express.js.

Base de Datos: MongoDB / PostgreSQL.
