import { readFileSync } from 'node:fs';

// French typography: thin no-break space before ; ! ? and a no-break space before : and inside guillemets.
export const fr = s => s.replace(/ ([;!?])/g, ' $1').replace(/ :/g, ' :').replace(/« /g, '« ').replace(/ »/g, ' »');
// In the sources, ¤ stands for a no-break space and ¦ for a thin no-break space.
export const typo = s => s.replace(/¤/g, ' ').replace(/¦/g, ' ');
// Definitions ship lightly encoded, so a peek at the page source does not spoil the game.
const enc = s => Buffer.from(s, 'utf8').toString('base64').split('').reverse().join('');

export function bankRows(path) {
  const bank = JSON.parse(readFileSync(path, 'utf8'));
  const seen = new Set();
  for (const e of bank) {
    if (!Array.isArray(e) || e.length !== 6) throw new Error('bank entry must be [mot, féminin, phonétique, nature, registre, définition]: ' + JSON.stringify(e));
    if (seen.has(e[0])) throw new Error('duplicate word in bank: ' + e[0]);
    seen.add(e[0]);
  }
  return bank.map(([w, fem, ipa, nat, lab, def]) => [w, fem, ipa, nat, lab, enc(fr(def))]);
}

export function bundleJs(dir, files, rows) {
  let js = files.map(f => '/* ' + f + ' */\n' + readFileSync(dir + f, 'utf8')).join('\n');
  if (!js.includes('/*BANK*/[]')) throw new Error('bank marker missing in core.js');
  js = js.replace('/*BANK*/[]', JSON.stringify(rows));
  return typo(js);
}

export function checkDashes(name, text) {
  if (/[\u2013\u2014]/.test(text)) throw new Error(name + ' contains an en or em dash; use a comma, a colon or a period');
}
