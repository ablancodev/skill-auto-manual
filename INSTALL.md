# auto-manual — instalación

Skill **global** de Claude Code que genera manuales de uso (capturas anotadas + vídeo +
Markdown/HTML) navegando una web/app real con Playwright. Disponible en cualquier proyecto.

## Requisitos
- Claude Code instalado y con sesión iniciada.
- Node.js ≥18 (o Docker como alternativa para Playwright).

## Instalar (desde el paquete portable)
```bash
bash install.sh
```
Esto copia la skill a `~/.claude/skills/auto-manual/` e instala Playwright dentro de ella
(solo la primera vez). A partir de ahí, en CUALQUIER proyecto:

```
claude
/auto-manual https://la-web.com "cómo registrarse"
```

## Qué genera (en el proyecto actual, carpeta `manuals/<id>/`)
- `manual.html` / `manual.md` — manual con capturas anotadas (recuadro "haz clic aquí").
- `video/walkthrough.webm` — vídeo del recorrido completo.
- `screenshots/` — una captura por paso.

## Notas
- Los resultados se guardan en el proyecto actual; la herramienta vive una sola vez en `~/.claude`.
- Es un borrador automático: revísalo antes de publicar. Re-ejecuta para refrescar capturas
  cuando cambie la UI.
- Para flujos con login/2FA/pago, usa datos de PRUEBA, nunca credenciales reales sensibles.
