// Driver persistente: abre UN navegador (con grabación de vídeo) y lo mantiene vivo,
// ejecutando comandos que le llegan por `commands.jsonl` y escribiendo el resultado de
// cada paso en `steps.jsonl` (+ screenshot anotado por paso).
//
// Uso (en segundo plano):  node bin/driver.mjs <outDir>
// El cliente `act.mjs` es quien encola comandos y espera resultados.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) { console.error('Uso: node driver.mjs <outDir>'); process.exit(1); }

const screensDir = path.join(outDir, 'screenshots');
const videoDir = path.join(outDir, 'video');
fs.mkdirSync(screensDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });
const cmdFile = path.join(outDir, 'commands.jsonl');
const stepFile = path.join(outDir, 'steps.jsonl');
const stateFile = path.join(outDir, 'state.json');
fs.writeFileSync(cmdFile, fs.existsSync(cmdFile) ? fs.readFileSync(cmdFile) : '');
const setState = (o) => fs.writeFileSync(stateFile, JSON.stringify(o, null, 2));

const VIEWPORT = { width: 1440, height: 900 };
const browser = await chromium.launch({ headless: true, slowMo: 250 });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: videoDir, size: VIEWPORT },
});
// Cursor virtual: Playwright no graba el puntero del sistema, así que dibujamos uno
// dentro de la página (sigue los eventos reales de ratón) + onda al hacer clic.
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById('__am_cursor')) return;
    const c = document.createElement('div');
    c.id = '__am_cursor';
    c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5.5 3.2 19 12.6l-6.3 1.2 3.5 6.3-2.7 1.4-3.4-6.4-4.6 4.5z" fill="#1a1a1a" stroke="#fff" stroke-width="1.5"/></svg>';
    Object.assign(c.style, {
      position: 'fixed', left: '-100px', top: '-100px', zIndex: 2147483647,
      pointerEvents: 'none', margin: '-2px 0 0 -2px',
    });
    (document.body || document.documentElement).appendChild(c);
    document.addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
    }, true);
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      Object.assign(r.style, {
        position: 'fixed', left: (e.clientX - 14) + 'px', top: (e.clientY - 14) + 'px',
        width: '28px', height: '28px', borderRadius: '50%',
        border: '3px solid #4f46e5', zIndex: 2147483646, pointerEvents: 'none',
        opacity: '0.9', transition: 'transform .45s ease-out, opacity .45s ease-out',
      });
      (document.body || document.documentElement).appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(2.2)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
});
const page = await context.newPage();
const video = page.video();
setState({ status: 'ready', step: 0 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Posición actual del ratón (Playwright no la expone) para animar desplazamientos.
let mouse = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
async function glideTo(x, y) {
  const dist = Math.hypot(x - mouse.x, y - mouse.y);
  const steps = Math.max(10, Math.min(50, Math.round(dist / 25)));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
  await sleep(150);
}
// Lleva el ratón (con animación) al centro del elemento. Devuelve false si no hay caja.
async function glideToLoc(loc) {
  await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await loc.boundingBox();
  if (!box) return false;
  await glideTo(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

async function resolve(cmd) {
  if (cmd.selector) return page.locator(cmd.selector).first();
  if (cmd.label) return page.getByLabel(cmd.label, { exact: false }).first();
  if (cmd.placeholder) return page.getByPlaceholder(cmd.placeholder, { exact: false }).first();
  const cands = [];
  if (cmd.role && cmd.name) cands.push(page.getByRole(cmd.role, { name: cmd.name }));
  if (cmd.text) cands.push(
    page.getByRole('button', { name: cmd.text }),
    page.getByRole('link', { name: cmd.text }),
    page.getByRole('tab', { name: cmd.text }),
    page.getByText(cmd.text, { exact: false }),
  );
  for (const c of cands) {
    try { const l = c.first(); if (await l.count() > 0) return l; } catch { /* siguiente */ }
  }
  throw new Error('No encuentro el elemento: ' + JSON.stringify({ text: cmd.text, role: cmd.role, name: cmd.name, selector: cmd.selector }));
}

async function highlight(loc) {
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
    await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const d = document.createElement('div');
      d.id = '__am_hl';
      Object.assign(d.style, {
        position: 'fixed', left: r.left - 4 + 'px', top: r.top - 4 + 'px',
        width: r.width + 8 + 'px', height: r.height + 8 + 'px',
        border: '3px solid #e5484d', borderRadius: '6px',
        boxShadow: '0 0 0 4px rgba(229,72,77,.25)', zIndex: 2147483647, pointerEvents: 'none',
      });
      document.body.appendChild(d);
    });
  } catch { /* sin anotación si falla */ }
}
const unhighlight = () => page.evaluate(() => document.getElementById('__am_hl')?.remove()).catch(() => {});

async function shot(id, res) {
  // Re-sincroniza el cursor virtual: tras una navegación, la página nueva no lo
  // posiciona hasta que llega un mousemove.
  await page.mouse.move(mouse.x, mouse.y, { steps: 1 }).catch(() => {});
  const file = `screenshots/step-${String(id).padStart(2, '0')}.png`;
  await page.screenshot({ path: path.join(outDir, file) });
  res.screenshot = file;
}

function append(res) { fs.appendFileSync(stepFile, JSON.stringify(res) + '\n'); }

async function handle(cmd) {
  const res = { id: cmd.id, action: cmd.action, caption: cmd.caption || '', ok: true };
  try {
    switch (cmd.action) {
      case 'goto':
        await page.goto(cmd.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(1500); await shot(cmd.id, res); break;
      case 'click': {
        const loc = await resolve(cmd);
        const hasBox = await glideToLoc(loc).catch(() => false);
        await highlight(loc); await shot(cmd.id, res); await unhighlight();
        if (hasBox) { await page.mouse.down(); await page.mouse.up(); }
        else await loc.click({ timeout: 15000 });
        await sleep(1200); break;
      }
      case 'fill': {
        const loc = await resolve(cmd);
        const hasBox = await glideToLoc(loc).catch(() => false);
        if (hasBox) { await page.mouse.down(); await page.mouse.up(); }
        await loc.fill(String(cmd.value ?? ''), { timeout: 15000 });
        await highlight(loc); await shot(cmd.id, res); await unhighlight(); break;
      }
      case 'press':
        await page.keyboard.press(cmd.key || 'Enter'); await sleep(1200); await shot(cmd.id, res); break;
      case 'scroll':
        await page.mouse.wheel(0, cmd.dy ?? 800); await sleep(700); await shot(cmd.id, res); break;
      case 'screenshot':
      case 'done':
        await sleep(400); await shot(cmd.id, res); break;
      default:
        res.ok = false; res.error = 'Acción desconocida: ' + cmd.action;
    }
  } catch (e) {
    res.ok = false; res.error = String(e?.message || e);
    try { await shot(cmd.id, res); } catch { /* nada */ }
  }
  res.url = page.url();
  try { res.title = await page.title(); } catch { /* nada */ }
  append(res);
  setState({ status: 'running', step: cmd.id });
  return cmd.action === 'done';
}

async function shutdown() {
  setState({ status: 'closing', step: -1 });
  try { await context.close(); } catch { /* nada */ }
  let rel = null;
  try {
    const raw = await video.path();
    rel = 'video/walkthrough.webm';
    fs.renameSync(raw, path.join(outDir, rel));
  } catch { /* sin vídeo */ }
  try { await browser.close(); } catch { /* nada */ }
  setState({ status: 'done', video: rel });
  process.exit(0);
}

// Bucle de sondeo de comandos
let processed = 0;
async function tick() {
  let lines = [];
  try { lines = fs.readFileSync(cmdFile, 'utf8').split('\n').filter(Boolean); } catch { /* aún no */ }
  while (processed < lines.length) {
    const line = lines[processed]; processed++;
    let cmd; try { cmd = JSON.parse(line); } catch { continue; }
    const isDone = await handle(cmd);
    if (isDone) return shutdown();
  }
  setTimeout(tick, 250);
}
tick();
