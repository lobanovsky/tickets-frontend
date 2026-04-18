#!/bin/sh
set -e

API_URL="${TICKETS_API_URL:-http://localhost:8080}"
ADMIN_KEY="${ADMIN_API_KEY:-admin-secret}"

sed -i "s|const API_URL = '.*'|const API_URL = '${API_URL}'|g" \
    /usr/share/nginx/html/js/api.js

sed -i "s|const API_KEY = '.*'|const API_KEY = '${ADMIN_KEY}'|g" \
    /usr/share/nginx/html/js/api.js

exec nginx -g "daemon off;"
