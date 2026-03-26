#!/bin/sh
set -eu

PORT="${PORT:-80}"
export PORT

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Configuracao em runtime para URL da API (evita rebuild para trocar endpoint).
API_URL="${VITE_API_URL:-http://localhost:8080}"
cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_URL: "${API_URL}"
};
EOF

exec nginx -g 'daemon off;'
