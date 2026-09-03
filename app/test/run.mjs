import assert from 'assert';
import { pathToFileURL } from 'url';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Imbracatura di test senza dipendenze.
//
// Il progetto gira su Node 14, che Vitest non supporta (ne chiede almeno 18) e
// su cui npm 6 installa a fatica il tooling moderno. Aggiornare il runtime è
// una decisione a sé, non da prendere di corsa: nel frattempo questo file fa
// il lavoro in una cinquantina di righe, funziona sia su Node 14 sia su Node
// 20 — che è quello della verifica automatica — e non aggiunge dipendenze a un
// progetto che ne ha tre in tutto.
//
// Si testano le funzioni pure: calcolo classifica, statistiche stagionali,
// rilevamento dei problemi, escape HTML, regole dei tre sport. Sono le parti
// dove un errore non si vede a schermo ma produce numeri sbagliati.

const results = [];
let current = 'senza gruppo';

export function describe(name, fn) {
  const prev = current;
  current = name;
  fn();
  current = prev;
}

export function test(name, fn) {
  try {
    fn();
    results.push({ group: current, name, ok: true });
  } catch (err) {
    results.push({ group: current, name, ok: false, err });
  }
}

export const eq = assert.deepStrictEqual;
export const is = assert.strictEqual;
export const ok = assert.ok;

// Niente `await` al primo livello: Node 14 lo rifiuta con uscita 13, e questo
// file deve girare sia lì sia sul Node della verifica automatica.
async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();

  for (const f of files) {
    await import(pathToFileURL(join(here, f)).href);
  }

  let lastGroup = null;
  let failed = 0;
  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log('\n  ' + r.group);
      lastGroup = r.group;
    }
    if (r.ok) {
      console.log('    ok   ' + r.name);
    } else {
      failed++;
      console.log('    FAIL ' + r.name);
      const msg = (r.err && r.err.message) || String(r.err);
      console.log('         ' + msg.split('\n').join('\n         '));
    }
  }

  const total = results.length;
  console.log(`\n  ${total - failed}/${total} test superati` + (failed ? ` — ${failed} falliti\n` : '\n'));
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error('\n  Impossibile eseguire i test:\n  ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
