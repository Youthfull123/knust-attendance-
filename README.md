# KNUST Attendance Site
1. cp .env.example .env.local; set DATABASE_URL (Neon) and AUTH_SECRET
2. npm install (postinstall copies face-api models to public/models), then npm run dev
3. Tables and venue directory are created on first request.
4. Edit venue coordinates in the venues table: seed values are approximate.
