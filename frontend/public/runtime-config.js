// Desenvolvimento local: evita 404 em GET /runtime-config.js (Vite serve `public/` na raiz).
// Em produção (Docker), o entrypoint substitui este arquivo pela URL real da API.
// Se não definir VITE_API_URL aqui, `src/services/api.ts` usa import.meta.env ou http://localhost:8080.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
