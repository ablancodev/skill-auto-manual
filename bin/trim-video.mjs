// Recorta los "tiempos muertos" del vídeo usando los timestamps t/tEnd de steps.jsonl:
// conserva solo los tramos en los que ocurre algo (con un pequeño margen) y descarta
// las esperas entre paso y paso (el tiempo en que el agente lee la captura y decide).
// Salida: <outDir>/video/walkthrough.mp4 (H.264, listo para compartir).
//
// Uso: node bin/trim-video.mjs <outDir> [--pad-ms 400] [--tail-ms 1000]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const outDir = process.argv[2];
if (!outDir) { console.error('Uso: node trim-video.mjs <outDir>'); process.exit(1); }

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? Number(process.argv[i + 1]) : def;
};
const PAD = arg('--pad-ms', 400);   // margen antes/después de cada acción
const TAIL = arg('--tail-ms', 1000); // extra al final del último paso

const input = path.join(outDir, 'video', 'walkthrough.webm');
const output = path.join(outDir, 'video', 'walkthrough.mp4');
if (!fs.existsSync(input)) { console.error('No existe ' + input); process.exit(1); }

// ffmpeg: el del sistema si lo hay; si no, el de @ffmpeg-installer (dependencia de la skill,
// el binario viene dentro del paquete npm — sin descargas post-install que puedan fallar).
let ffmpeg = 'ffmpeg';
try { execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' }); }
catch {
  try { ffmpeg = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path; }
  catch { console.error('No hay ffmpeg (ni @ffmpeg-installer/ffmpeg). Ejecuta npm install en la skill.'); process.exit(1); }
  try { fs.chmodSync(ffmpeg, 0o755); } catch { /* por si npm lo deja sin +x */ }
}

// Tramos a conservar: [t-PAD, tEnd+PAD] de cada paso, fusionando los que se tocan.
const steps = fs.readFileSync(path.join(outDir, 'steps.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.tEnd))
  .sort((a, b) => a.t - b.t);
if (!steps.length) { console.error('steps.jsonl sin timestamps t/tEnd; nada que recortar.'); process.exit(1); }

const segments = [];
for (const s of steps) {
  // En un `goto`, entre t y tEnd está la carga de la página (pantalla en blanco):
  // conserva solo el tramo final, con la página ya renderizada.
  const from = s.action === 'goto' ? Math.max(s.t, s.tEnd - 2000) : s.t;
  const start = Math.max(0, from - PAD);
  const end = s.tEnd + PAD;
  const last = segments[segments.length - 1];
  if (last && start <= last.end + 200) last.end = Math.max(last.end, end);
  else segments.push({ start, end });
}
segments[segments.length - 1].end += TAIL;

const totalKept = segments.reduce((a, s) => a + (s.end - s.start), 0);
const sec = (ms) => (ms / 1000).toFixed(3);

// Un trim por tramo + concat, reencodando a H.264 (frame rate constante para cortes limpios).
const parts = segments.map((s, i) =>
  `[0:v]trim=start=${sec(s.start)}:end=${sec(s.end)},setpts=PTS-STARTPTS[v${i}]`);
const filter = parts.join(';') + ';' +
  segments.map((_, i) => `[v${i}]`).join('') +
  `concat=n=${segments.length}:v=1:a=0[out]`;

execFileSync(ffmpeg, [
  '-y', '-i', input,
  '-filter_complex', filter, '-map', '[out]',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart',
  output,
], { stdio: ['ignore', 'ignore', 'inherit'] });

console.log(`OK ${path.relative(outDir, output)} — ${segments.length} tramos, ~${Math.round(totalKept / 1000)}s conservados (de ${Math.round(steps[steps.length - 1].tEnd / 1000)}s de grabación).`);
