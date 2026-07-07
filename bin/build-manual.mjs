// Monta el manual final a partir de steps.jsonl + meta.json:
//   <outDir>/manual.md  y  <outDir>/manual.html  (con capturas anotadas y enlace al vídeo)
// Uso: node bin/build-manual.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) { console.error('Uso: node build-manual.mjs <outDir>'); process.exit(1); }

const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8'));
const state = fs.existsSync(path.join(outDir, 'state.json'))
  ? JSON.parse(fs.readFileSync(path.join(outDir, 'state.json'), 'utf8')) : {};
const steps = fs.readFileSync(path.join(outDir, 'steps.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

// Solo los pasos con caption entran como "paso del manual"; el resto quedan como soporte.
const manualSteps = steps.filter((s) => (s.caption || '').trim().length > 0);
const video = state.video || (fs.existsSync(path.join(outDir, 'video', 'walkthrough.webm')) ? 'video/walkthrough.webm' : null);

const title = meta.titulo || `Cómo: ${meta.task}`;

// ---------- Markdown ----------
let md = `# ${title}\n\n`;
md += `> ${meta.url}  ·  generado el ${meta.generado || ''}\n\n`;
if (meta.audiencia) md += `*Audiencia: ${meta.audiencia}*\n\n`;
if (video) md += `🎥 [Ver vídeo del recorrido](${video})\n\n`;
md += `---\n\n`;
manualSteps.forEach((s, i) => {
  md += `## Paso ${i + 1}\n\n${s.caption}\n\n`;
  if (s.screenshot) md += `![Paso ${i + 1}](${s.screenshot})\n\n`;
  if (!s.ok && s.error) md += `> ⚠️ Nota: en este paso hubo una incidencia (${s.error}).\n\n`;
});
fs.writeFileSync(path.join(outDir, 'manual.md'), md);

// ---------- HTML ----------
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const stepsHtml = manualSteps.map((s, i) => `
  <section class="step">
    <div class="n">${i + 1}</div>
    <div class="body">
      <p class="cap">${esc(s.caption)}</p>
      ${s.screenshot ? `<img src="${esc(s.screenshot)}" alt="Paso ${i + 1}">` : ''}
      ${!s.ok && s.error ? `<p class="warn">⚠️ Incidencia: ${esc(s.error)}</p>` : ''}
    </div>
  </section>`).join('');

const html = `<!doctype html><html lang="${esc(meta.lang || 'es')}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a}
  body{max-width:840px;margin:0 auto;padding:40px 20px;background:#fafafa;line-height:1.55}
  h1{font-size:26px;margin:0 0 6px} .meta{color:#888;font-size:13px;margin-bottom:6px}
  .aud{color:#555;font-size:13px;font-style:italic}
  .video{display:inline-block;margin:14px 0;padding:10px 16px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-size:14px}
  .step{display:flex;gap:16px;background:#fff;border:1px solid #eee;border-radius:14px;padding:18px;margin:16px 0}
  .n{flex:0 0 34px;height:34px;line-height:34px;text-align:center;background:#111;color:#fff;border-radius:50%;font-weight:700}
  .body{flex:1} .cap{margin:4px 0 12px;font-size:16px}
  .body img{width:100%;border:1px solid #eee;border-radius:10px;display:block}
  .warn{color:#c0322f;font-size:13px;margin-top:8px}
  footer{margin-top:32px;color:#aaa;font-size:11px;text-align:center}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">${esc(meta.url || '')} · generado el ${esc(meta.generado || '')}</div>
${meta.audiencia ? `<div class="aud">Audiencia: ${esc(meta.audiencia)}</div>` : ''}
${video ? `<a class="video" href="${esc(video)}">🎥 Ver vídeo del recorrido</a>` : ''}
${stepsHtml}
<footer>Generado por auto-manual · captura real con Playwright · revisa el resultado antes de publicar</footer>
</body></html>`;
fs.writeFileSync(path.join(outDir, 'manual.html'), html);

console.log(`OK manual.md + manual.html (${manualSteps.length} pasos${video ? ' + vídeo' : ''}) en ${outDir}`);
