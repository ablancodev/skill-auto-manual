// Cliente: encola UN comando para el driver y espera su resultado.
// Uso: node bin/act.mjs <outDir> '<json-comando>'
// Ejemplos de comando:
//   {"action":"goto","url":"https://ejemplo.com","caption":"Abre la web"}
//   {"action":"click","text":"Registrarse","caption":"Haz clic en «Registrarse» (arriba dcha)"}
//   {"action":"fill","label":"Email","value":"demo@test.com","caption":"Escribe tu email"}
//   {"action":"press","key":"Enter"}
//   {"action":"scroll","dy":900}
//   {"action":"screenshot","caption":"Pantalla de bienvenida"}
//   {"action":"done","caption":"Proceso terminado"}
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
const cmdJson = process.argv[3];
if (!outDir || !cmdJson) { console.error("Uso: node act.mjs <outDir> '<json>'"); process.exit(1); }

const cmdFile = path.join(outDir, 'commands.jsonl');
const stepFile = path.join(outDir, 'steps.jsonl');

let cmd;
try { cmd = JSON.parse(cmdJson); } catch (e) { console.error('JSON inválido:', e.message); process.exit(1); }

let existing = 0;
try { existing = fs.readFileSync(cmdFile, 'utf8').split('\n').filter(Boolean).length; } catch { /* primera vez */ }
const id = existing + 1;
cmd.id = id;
fs.appendFileSync(cmdFile, JSON.stringify(cmd) + '\n');

const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  let lines = [];
  try { lines = fs.readFileSync(stepFile, 'utf8').split('\n').filter(Boolean); } catch { /* aún no */ }
  for (const l of lines) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    if (r.id === id) { console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 2); }
  }
  await new Promise((res) => setTimeout(res, 300));
}
console.log(JSON.stringify({ id, ok: false, error: 'timeout esperando al driver (¿está corriendo en segundo plano?)' }));
process.exit(1);
