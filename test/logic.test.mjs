// Game rules check: node test/logic.test.mjs (also: npm test)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { bankRows } from '../scripts/bundle.mjs';

const root = new URL('..', import.meta.url).pathname;
const rows = bankRows(root + 'src/bank.json');
const logic = readFileSync(root + 'src/core.js', 'utf8').split('/*LOGIC-START*/')[1].split('/*LOGIC-END*/')[0];
const L = new Function('BANK', `const BY_WORD = new Map(BANK.map((e, i) => [e[0], i]));\n${logic}\nreturn { RULES, enc, dec, freshState, startRound, pickWord, knewWord, skipLead, toVote, toReveal, ranking, reached, trueDefOf };`)(rows);

const keyOf = S => JSON.parse(L.dec(S.key));
const optBy = (S, author) => { const k = keyOf(S); return Object.keys(k).find(x => k[x] === author); };

// Every definition decodes, with French spacing and no long dashes
for (const e of rows) {
  const d = L.dec(e[5]);
  assert.ok(d.length > 3, 'empty definition: ' + e[0]);
  assert.ok(!/[\u2013\u2014]/.test(d), 'dash in ' + e[0]);
  assert.ok(!/ [;:!?»]/.test(d) && !/« /.test(d), 'plain space before punctuation in ' + e[0]);
}

// Word bank, three players
const order = ['A', 'B', 'C'];
let S = L.startRound(Object.assign(L.freshState(null), { round: 0 }), order);
assert.equal(S.phase, 'write'); assert.ok(S.word.w);
const truth = L.trueDefOf(S);
const subs = { A: { rk: S.rk, def: 'Faux A' }, B: { rk: S.rk, def: 'Faux B' }, C: { rk: S.rk, def: 'Faux C' }, Z: { rk: 'old', def: 'ancien' } };
S = L.toVote(S, subs);
assert.equal(S.phase, 'vote'); assert.equal(S.opts.length, 4); assert.ok(S.opts.some(o => o.t === truth));
subs.A.vote = optBy(S, '*'); subs.B.vote = optBy(S, 'A'); subs.C.vote = optBy(S, 'C');
S = L.toReveal(S, subs);
assert.deepEqual(S.scores, { A: 3 });
assert.deepEqual(S.hist[0].b, { a: 'A', n: 1 });
const k = L.knewWord(L.startRound(S, order), 'B');
assert.equal(k.phase, 'write'); assert.equal(k.note.by, 'B');

// No bluff at all goes straight to the reveal
const N = L.toVote(L.startRound(Object.assign(L.freshState(null), { round: 0 }), order), {});
assert.equal(N.phase, 'reveal'); assert.equal(N.reveal.voted, 0);

// Real dictionary mode: rotating leader, +3 when nobody finds
let D = L.freshState(null); D.settings.src = 'dict';
D = L.startRound(Object.assign(D, { round: 0 }), order);
assert.equal(D.phase, 'pick'); assert.equal(D.meneur, 'A');
assert.equal(L.pickWord(D, 'B', { w: 'mot', def: 'Une définition.' }), null);
D = L.pickWord(D, 'A', { w: 'zygomorphe', nat: 'adj.', def: 'Se dit d’une fleur à symétrie bilatérale.' });
const ds = { B: { rk: D.rk, def: 'Faux B' }, C: { rk: D.rk, def: 'Faux C' } };
D = L.toVote(D, ds);
ds.B.vote = optBy(D, 'C'); ds.C.vote = optBy(D, 'B');
D = L.toReveal(D, ds);
assert.deepEqual(D.scores, { B: 1, C: 1, A: 3 });
assert.equal(L.startRound(D, order).meneur, 'B');

// Ranking with ties
assert.deepEqual(L.ranking({ A: 3, B: 3, C: 1 }, ['C', 'B', 'A']).map(r => [r.u, r.r]), [['B', 1], ['A', 1], ['C', 3]]);
assert.equal(L.reached({ A: 15 }, 15), true);
console.log('Rules OK,', rows.length, 'words.');
