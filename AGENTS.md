# GoTrack — Monorepo

GoTrack is a running/training tracker. This repo is a monorepo:

```
├── app-mobile/      # Mobile client: React Native + Expo (SDK ~57), JS, npm
├── gotrack-backend/ # REST API: Node.js + Express (server.js, port 3000), npm
└── README.md
```

See `app-mobile/AGENTS.md` for mobile-specific rules. Backend notes:

- Entry point: `gotrack-backend/server.js` (`npm start`).
- In-memory storage (`carreras` array) — data resets on restart; no DB yet.
- `cors` enabled; endpoints: `GET /api/carreras`, `POST /api/carreras`.
- Keep API contracts in sync with what `app-mobile/App.js` expects when changing sync logic.
