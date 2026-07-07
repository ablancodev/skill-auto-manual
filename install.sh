#!/usr/bin/env bash
# Instala la skill auto-manual como skill GLOBAL de Claude Code.
# Uso: bash install.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude/skills/auto-manual"

mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules --exclude setup.log --exclude .DS_Store --exclude install.sh \
  "$SRC/" "$DEST/"

echo "Skill copiada a $DEST"
echo "Instalando Playwright dentro de la skill (solo la primera vez)..."
bash "$DEST/bin/setup.sh"
echo
echo "Listo. En cualquier proyecto, dentro de claude:"
echo '  /auto-manual https://tu-app.com "cómo crear una factura"'
