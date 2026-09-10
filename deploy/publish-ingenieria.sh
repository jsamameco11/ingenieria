#!/usr/bin/env bash
# Publicar MemoriaCalc en ingenieria.miacademiapreu.com
# Uso en el VPS (como root), desde la carpeta del proyecto:
#   bash deploy/publish-ingenieria.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MEMORCALC_ROOT:-/opt/memorcalc}"

echo "==> Build local ya debe existir en dist/"
test -f "$ROOT/dist/index.html"

echo "==> Copiar frontend"
mkdir -p "$APP/dist" "$APP"
rsync -a --delete "$ROOT/dist/" "$APP/dist/"

echo "==> Copiar API Culqi + google-session"
cp "$ROOT/server/culqi-server.mjs" "$APP/culqi-server.mjs"
cp "$ROOT/server/prompt.mjs" "$APP/prompt.mjs" 2>/dev/null || true
cp "$ROOT/server/google-session.php" "$APP/google-session.php" 2>/dev/null || true

if [[ -f "$ROOT/deploy/nginx-ingenieria.conf" ]]; then
  echo "==> Nginx (revise rutas de include)"
  cp "$ROOT/deploy/nginx-ingenieria.conf" /etc/nginx/sites-available/ingenieria.miacademiapreu.com
  ln -sf /etc/nginx/sites-available/ingenieria.miacademiapreu.com /etc/nginx/sites-enabled/ingenieria.miacademiapreu.com
  nginx -t && systemctl reload nginx
fi

if [[ -f "$ROOT/deploy/memorcalc-culqi.service" ]]; then
  cp "$ROOT/deploy/memorcalc-culqi.service" /etc/systemd/system/memorcalc-culqi.service
  systemctl daemon-reload
  systemctl enable --now memorcalc-culqi
  systemctl restart memorcalc-culqi
fi

echo "==> Listo. Pruebe login en https://ingenieria.miacademiapreu.com"
