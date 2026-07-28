// Same-origin /api/... everywhere: Vite proxies to the backend in dev,
// Caddy reverse-proxies in prod. Keeps HTTPS tunnels free of mixed content.
export const API_BASE_URL = '';
