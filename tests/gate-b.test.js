/* Gate B — all six scripted dictations must produce the expected Record
   after confirmation, computed locally (no network involved anywhere). */
const assert = require('node:assert');
const Core = require('../relay-core.js');
const CASES = require('../demo-data.js');

let passed = 0;
const records = [];

for (const c of CASES) {
  const draft = Core.parseDictation(c.dictation);
  const t = Date.parse('2026-10-31T14:30:00-05:00') + c.id * 60000;
  const rec = Core.buildRecord(draft,
    { confirmMedication: c.confirmMedication },
    { online: c.online, recordId: 'test-' + c.id, createdAt: new Date(t - 60000).toISOString(), confirmedAt: new Date(t).toISOString() });
  records.push(rec);
  const e = c.expected;
  assert.strictEqual(rec.tag, e.tag, `case ${c.id} tag`);
  assert.strictEqual(rec.category, e.category, `case ${c.id} category`);
  assert.deepStrictEqual(rec.careGiven, e.careGiven, `case ${c.id} careGiven: got ${JSON.stringify(rec.careGiven)}`);
  assert.strictEqual(rec.medications.length, e.medicationCount, `case ${c.id} medication count`);
  assert.ok(rec.narrative.includes(e.narrativeIncludes), `case ${c.id} narrative: "${rec.narrative}" should include "${e.narrativeIncludes}"`);
  assert.strictEqual(rec.syncState, e.syncState, `case ${c.id} syncState`);
  assert.strictEqual(rec.confirmationState, 'confirmed', `case ${c.id} confirmationState`);
  if (e.unconfirmedMentionsInsulin) {
    assert.strictEqual(draft.unconfirmedItems.length, 1, 'case 6 must carry exactly one unconfirmed item');
    assert.ok(/insulin/i.test(draft.unconfirmedItems[0].text), 'case 6 unconfirmed item must name insulin');
    assert.strictEqual(draft.unconfirmedItems[0].ambiguous, true, 'case 6 item must be ambiguous');
    assert.ok(!/insulin/i.test(JSON.stringify(rec)), 'case 6 record must not contain insulin anywhere');
  }
  if (c.id === 1) {
    assert.strictEqual(rec.medications[0].name, 'morphine');
    assert.strictEqual(rec.medications[0].dose, '4 mg');
    assert.strictEqual(rec.medications[0].route, 'IV');
  }
  passed++;
  console.log(`case ${c.id} (${c.tag}) PASS — ${rec.category}, care=[${rec.careGiven.join(', ')}], meds=${rec.medications.length}, sync=${rec.syncState}`);
  console.log(`   narrative: "${rec.narrative}"`);
}

const order = Core.sortBoard(records).map(r => r.tag);
assert.deepStrictEqual(order, ['R-07', 'R-09', 'Y-12', 'Y-15', 'G-03', 'K-02'], `board order: got ${order.join(', ')}`);
console.log('board order PASS — ' + order.join(' → '));
console.log(`\nGATE B: ${passed}/6 cases PASS, board order PASS`);
