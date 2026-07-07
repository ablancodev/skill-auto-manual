# auto-manual

Skill global de [Claude Code](https://claude.com/claude-code) que genera **manuales de uso y
vídeo-tutoriales automáticos** de cualquier aplicación web: Claude conduce un navegador real
(Playwright) para completar la tarea que le pidas, y de ese recorrido salen:

- 🎬 `video/walkthrough.webm` — vídeo del recorrido completo, **con cursor visible**
  (flecha que se desplaza hasta cada elemento y onda azul en cada clic).
- 🖼️ `screenshots/` — una captura por paso, **anotada** con un recuadro rojo sobre el
  elemento que hay que pulsar o rellenar.
- 📄 `manual.md` / `manual.html` — manual paso a paso montado con esas capturas y textos
  en el idioma y tono que pidas.

Todo se guarda en el proyecto desde el que lo ejecutes, en `manuals/<fecha>-<tarea>/`.

La gracia frente a grabar a mano: cuando la interfaz cambie, **re-ejecutas y se regenera**
el manual y el vídeo con capturas frescas.

## Cómo funciona

No hay scripts grabados ni selectores frágiles: Claude mira una captura de pantalla tras
cada acción y decide el siguiente paso como lo haría una persona ("veo el botón «Entrar»,
lo pulso"). Los elementos se localizan por su **texto visible**, rol o etiqueta de
formulario, con selectores CSS solo como último recurso (p. ej. iconos sin texto).

Por debajo hay tres piezas (`bin/`):

| Pieza | Qué hace |
|---|---|
| `driver.mjs` | Mantiene abierto un Chromium con grabación de vídeo y cursor virtual, y ejecuta las acciones que le llegan por `commands.jsonl`. |
| `act.mjs` | Cliente: encola una acción JSON y devuelve el resultado + captura. |
| `build-manual.mjs` | Monta `manual.md` y `manual.html` a partir de los pasos con caption. |

## Requisitos

- Claude Code instalado y con sesión iniciada.
- Node.js ≥ 18 (si no hay Node, el setup intenta usar Docker con la imagen de Playwright).

## Instalación

```bash
bash install.sh
```

Copia la skill a `~/.claude/skills/auto-manual/` (disponible en **todos** tus proyectos) e
instala Playwright dentro de la propia skill — no ensucia tus proyectos.

## Uso

Desde cualquier proyecto, dentro de `claude`:

```
/auto-manual https://mi-app.com "cómo crear una factura"
```

O simplemente pídelo en lenguaje natural: «hazme un manual con vídeo de cómo registrarse
en https://mi-app.com».

### Qué conviene indicar

Lo único imprescindible es la **URL** y la **tarea**. Todo lo demás tiene valores por
defecto razonables, pero puedes afinar:

- **Tarea concreta**: mejor «crear una factura con IVA al 21 % y descargarla en PDF» que
  «probar facturas». Cuanto más concreto, mejor manual.
- **Idioma y tono** de los textos: «en español, tono no técnico», «in English, for
  developers»…
- **Credenciales / datos de prueba** si el flujo requiere login o formularios. ⚠️ Usa
  siempre datos de PRUEBA, nunca credenciales reales sensibles. Los flujos con 2FA o pago
  real hay que acordarlos antes.
- **Detalle de navegación** si te importa cómo se ve el vídeo: «haz scroll a velocidad
  media hasta el final del listado», «detente 2 segundos en la pantalla de confirmación».
- **Qué pasos deben salir en el manual**: por defecto se documentan los pasos relevantes;
  puedes pedir «solo documenta desde el login» o «incluye también los filtros».
- **Dispositivo**: por defecto escritorio (1440×900). Pide «en móvil» o un dispositivo
  concreto («como iPhone 15», «en una tablet») y el vídeo y las capturas salen con ese
  viewport, user-agent y densidad de píxeles reales (perfiles de `playwright.devices`).
  En móvil el cursor se dibuja como un dedo (círculo) en lugar de flecha. Puedes grabar
  el mismo flujo en escritorio y móvil y tener ambos manuales de la misma versión de la app.

### Ejemplos de peticiones

```
/auto-manual https://app.miempresa.com "proceso de login" — en español, tono no técnico,
usuario demo@miempresa.com / clave Demo1234

/auto-manual http://localhost:8080 "crear un proyecto nuevo y asignarle un responsable"

/auto-manual https://intranet.miempresa.com/facturas "emitir una factura rectificativa",
manual en español e inglés
```

### Múltiples idiomas o tonos

El recorrido se graba una vez; los textos de los pasos se pueden regenerar en otro idioma
o tono (técnico / no técnico) sin volver a navegar. Pídelo en la misma sesión.

## Salida

```
manuals/20260707-123503-crear-factura/
├── manual.html          ← manual visual (ábrelo en el navegador)
├── manual.md            ← misma guía en Markdown (para wikis/repos)
├── video/walkthrough.webm
├── screenshots/step-NN.png
├── meta.json            ← URL, tarea, idioma, fecha
└── steps.jsonl          ← registro de cada acción (auditable/reproducible)
```

Cada línea de `steps.jsonl` incluye `t` y `tEnd`: milisegundos desde el inicio de la
grabación en que empieza y termina el paso. Con eso se puede post-procesar el vídeo de
forma sincronizada: generar locución por TTS a partir de los `caption`, subtítulos `.srt`,
o un slideshow narrado a partir de las capturas — sin volver a navegar.

## Posibles usos

- **Documentación de producto**: manual de usuario que se regenera con cada release.
- **Onboarding interno**: «cómo dar de alta un cliente en la intranet», con vídeo.
- **Soporte**: responder a un cliente con una guía paso a paso hecha en minutos.
- **QA visual ligero**: si el flujo deja de completarse, el manual falla y lo ves
  (el paso con `ok:false` incluye la captura del error).
- **Changelogs visuales**: regrabar el mismo flujo antes/después de un cambio de UI.
- **Flujos predefinidos** (idea de ampliación): guardar la secuencia de acciones en
  `flows/<tarea>.json` y regrabar con un solo comando sin redescubrir la interfaz —
  `steps.jsonl` de una ejecución previa ya contiene casi todo lo necesario.

## Consejos y límites

- Es un **borrador automático**: revísalo antes de publicar.
- Elementos sin texto ni etiqueta accesible (iconos pelados) obligan a usar selectores
  CSS; añadir `aria-label`/`title` a esos botones hace el flujo más robusto (y mejora la
  accesibilidad de tu app).
- El vídeo se graba a 1440×900 (o al viewport del dispositivo emulado, en vertical si es
  móvil). Formato `.webm`; si necesitas `.mp4`, conviértelo con ffmpeg:
  `ffmpeg -i walkthrough.webm walkthrough.mp4`.
- El navegador corre en headless: el cursor que ves en el vídeo es un cursor virtual
  inyectado (el puntero real no existe en headless).
- Aplicaciones detrás de VPN/localhost funcionan sin problema: el navegador corre en tu
  máquina.
