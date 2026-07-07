---
name: auto-manual
description: Genera un manual de uso paso a paso (capturas anotadas + vídeo + Markdown/HTML) navegando una web o aplicación REAL con Playwright. Úsalo cuando el usuario quiera documentar un flujo ("cómo registrarse", "cómo crear X", "guía de uso", "manual con capturas/vídeo"). Acepta una URL y una tarea. Disponible en cualquier proyecto (skill global).
---

# auto-manual — generador de manuales navegando la web real

Conduces un navegador real con Playwright para **completar una tarea y documentarla**. Aquí
SÍ quieres ir directo y sin errores (no simulas a un usuario torpe): el objetivo es un manual
limpio. Cada acción produce una captura anotada (recuadro sobre el elemento) y un texto de paso.

## Paso 0 — Rutas
- `SKILL_DIR="$HOME/.claude/skills/auto-manual"` (aquí están `bin/` y Playwright).
- Los **resultados van al proyecto actual**: `OUT="manuals/<YYYYMMDD-HHMMSS>-<slug-tarea>"`.

## Paso 1 — Brief (pregunta lo que falte con AskUserQuestion)
- **URL** de inicio.
- **Tarea** a documentar (ej. "registrarse", "crear un proyecto", "cambiar la contraseña").
- **Audiencia/tono** del manual (no técnico / técnico / neutro) y **idioma**.
- **Dispositivo**: escritorio (por defecto) o móvil/tablet si el usuario lo pide.
- **Credenciales/datos de prueba** si el flujo los requiere (email, etc.). Avisa de que NO
  use datos reales sensibles. Si el flujo necesita login de pago o 2FA, dilo y acuérdalo con el usuario.

## Paso 2 — Setup e inicio del navegador
1. `bash "$SKILL_DIR/bin/setup.sh"` → lee la última línea (`local`/`docker`).
2. Crea `OUT/` y escribe `OUT/meta.json`:
   `{ "url","task","titulo","audiencia","lang","generado":"<fecha ISO>" }`.
   - **Manual móvil**: añade `"device":"<nombre de playwright.devices>"` (p. ej. `"iPhone 15"`,
     `"Pixel 7"`, `"iPad Mini"`). El vídeo/capturas salen con ese viewport y el cursor se
     dibuja como un dedo (círculo). Escribe meta.json ANTES de arrancar el driver (lo lee al inicio).
3. Arranca el driver EN SEGUNDO PLANO (mantiene la sesión viva y graba vídeo):
   `node "$SKILL_DIR/bin/driver.mjs" "<OUT>"`  (run_in_background)
   - Si el setup dio `docker`, ejecuta el driver dentro del contenedor montando ambos
     directorios (skill y proyecto). Pídelo solo si no hay Node local.
4. Espera 1-2 s a que `OUT/state.json` tenga `status: "ready"`.

## Paso 3 — Conduce y documenta (el bucle)
Usa `node "$SKILL_DIR/bin/act.mjs" "<OUT>" '<json>'` para CADA acción. Tras cada llamada,
**lee la captura** que devuelve (`screenshots/step-NN.png`) con la herramienta Read para ver
la pantalla y decidir el siguiente paso. Decide SIEMPRE mirando la captura, como una persona.

Acciones disponibles (el `caption` es el TEXTO del paso del manual, en el idioma/tono pedido):
- `{"action":"goto","url":"...","caption":"..."}`
- `{"action":"click","text":"texto visible del botón/enlace","caption":"..."}`
  (o `"role"+"name"`, o `"selector"` CSS si hace falta)
- `{"action":"fill","label":"Email","value":"...","caption":"..."}` (o `placeholder`/`selector`)
- `{"action":"press","key":"Enter"}`
- `{"action":"scroll","dy":900}`
- `{"action":"screenshot","caption":"Pantalla final / resultado"}`
- `{"action":"done","caption":"..."}`  ← cierra la sesión y vuelca el vídeo

Reglas del bucle:
1. Empieza con `goto` a la URL.
2. Avanza paso a paso hacia la tarea. **Pon `caption` solo a los pasos que deben salir en el
   manual** (los movimientos de apoyo, como un scroll exploratorio, pueden ir sin caption).
3. Escribe captions claros, en imperativo y en el tono/idioma pedido ("Haz clic en «Crear cuenta»").
4. Si una acción devuelve `ok:false`, mira la captura del error, corrige (otro texto/selector) y reintenta.
5. Cuando completes la tarea, haz un `screenshot` del estado final con caption, y luego `done`.
6. No inventes pasos: documenta lo que realmente ocurre en pantalla.

## Paso 4 — Monta el manual
1. Espera a que `OUT/state.json` tenga `status: "done"` (el vídeo se vuelca al cerrar).
2. `node "$SKILL_DIR/bin/build-manual.mjs" "<OUT>"` → genera `manual.md` y `manual.html`.

## Paso 5 — Entrega
Reporta al usuario y abre `OUT/manual.html`. Lista lo generado:
- `manual.html` / `manual.md` (manual con capturas anotadas)
- `video/walkthrough.webm` (vídeo del recorrido)
- `screenshots/` (capturas por paso)
Recuérdale que es un **borrador automático**: conviene una revisión humana antes de publicar,
y que con re-ejecutar se **regenera con capturas frescas** cuando cambie la UI.

## Notas
- El vídeo muestra un cursor virtual (en headless no se graba el puntero real): el driver
  anima el ratón hasta cada elemento antes de pulsar y dibuja una onda en cada clic.
- Multi-idioma/tono: para varias versiones, repite Paso 3-4 cambiando `lang`/tono en `meta.json`
  y los captions (la navegación puede reusarse).
- Tonos por persona: puedes encarnar una persona (lenguaje simple vs técnico) para los captions.
- Seguridad: nunca uses credenciales reales sensibles; usa datos de prueba.
