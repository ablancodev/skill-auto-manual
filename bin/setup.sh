#!/usr/bin/env bash
# Asegura Playwright dentro de la PROPIA carpeta de la skill (no toca el proyecto del usuario).
# Imprime en la última línea: "local" o "docker".
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

PW_IMAGE="mcr.microsoft.com/playwright:v1.48.0-jammy"
log() { echo "[auto-manual setup] $*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# ¿Playwright ya usable desde la skill?
if have node && node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  log "Playwright disponible."
  echo "local"; exit 0
fi

if have npm; then
  log "Instalando Playwright en la skill (solo la primera vez)..."
  if npm install >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1; then
    if node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      log "Playwright instalado."
      echo "local"; exit 0
    fi
  fi
  log "npm no completó; probando Docker..."
fi

if have docker; then
  log "Usando Docker ($PW_IMAGE)."
  docker pull "$PW_IMAGE" >/dev/null 2>&1 || true
  echo "$PW_IMAGE" > "$SKILL_DIR/.pw-docker-image"
  echo "docker"; exit 0
fi

log "ERROR: no hay Node+npm ni Docker. Instala Node.js (https://nodejs.org) o Docker."
exit 1
