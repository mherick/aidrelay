/* Gate D — boundary set. 20 adversarial dictations: advice requests,
   instructions, diagnoses, and suggestions must never become record facts.
   Plus: handoffs for the six demo records must restate confirmed facts
   with zero app-generated advice language. */
const assert = require('node:assert');
const Core = require('../relay-core.js');
const CASES = require('../demo-data.js');

const ADVERSARIAL = [
  { n: 1, text: 'Tag A-01. Red, immediate. You should apply a tourniquet to his leg.', noCare: ['tourniquet_applied'], noMed: true },
  { n: 2, text: 'Tag A-02. Yellow, delayed. He needs oxygen, somebody get oxygen over here.', noCare: ['oxygen_applied'], noMed: true },
  { n: 3, text: 'Tag A-03. Green, minor. He should get morphine 10 milligrams IV for the pain.', noCare: [], noMed: true },
  { n: 4, text: 'Tag A-04. Yellow, delayed. Give him 5 milligrams of morphine IV.', noCare: [], noMed: true },
  { n: 5, text: 'Tag A-05. Red, immediate. Start CPR now, hurry.', noCare: ['cpr_in_progress'], noMed: true },
  { n: 6, text: 'Tag A-06. Red, immediate. Apply an AED to her chest.', noCare: ['aed_applied'], noMed: true },
  { n: 7, text: 'Tag A-07. Yellow, delayed. Put a splint on that arm.', noCare: ['splint_applied'], noMed: true },
  { n: 8, text: 'Tag A-08. Green, minor. Wrap him in a blanket to keep him warm.', noCare: ['kept_warm'], noMed: true },
  { n: 9, text: 'Tag A-09. Red, immediate. Apply direct pressure to the wound.', noCare: ['direct_pressure'], noMed: true },
  { n: 10, text: 'Tag A-10. Yellow, delayed. He needs an IV started right away.', noCare: ['iv_started'], noMed: true },
  { n: 11, text: 'Tag A-11. Yellow, delayed. She needs fluids started right away.', noCare: ['fluids_started'], noMed: true },
  { n: 12, text: 'Tag A-12. Red, immediate. Apply a chest seal to that wound.', noCare: ['chest_seal_applied'], noMed: true },
  { n: 13, text: 'Tag A-13. Green, minor. Looks like a heart attack to me.', noCare: ['tourniquet_applied', 'oxygen_applied', 'medication_given'], noMed: true },
  { n: 14, text: 'Tag A-14. Red, immediate. He was given ketamine 20 milligrams IV by the other crew.', noCare: [], noMed: false, medName: 'ketamine' },
  { n: 15, text: 'Tag A-15. Yellow, delayed. Morphine would really help him right now.', noCare: [], noMed: true },
  { n: 16, text: 'Tag A-16. What category would you put this one in?', noCare: [], noMed: true, category: null },
  { n: 17, text: 'Tag A-17. Black, expectant. Pronounced at the scene, stop everything.', noCare: ['cpr_in_progress', 'aed_applied'], noMed: true, category: 'BLACK' },
  { n: 18, text: 'Tag A-18. Green, minor. Give her some water and keep her warm.', noCare: ['kept_warm'], noMed: true },
  { n: 19, text: 'Tag A-19. Yellow, delayed. Tourniquet is on his arm, placed there by a bystander.', noCare: [], care: ['tourniquet_applied'], noMed: true },
  { n: 20, text: 'Tag A-20. Red, immediate. IO was started by the medic, fluids running.', noCare: [], care: ['io_started', 'fluids_started'], noMed: true }
];

let passed = 0;
for (const a of ADVERSARIAL) {
  const d = Core.parseDictation(a.text);
  for (const id of a.noCare) assert.ok(!d.careGiven.includes(id), `input ${a.n}: ${id} must NOT be recorded`);
  for (const id of (a.care || [])) assert.ok(d.careGiven.includes(id), `input ${a.n}: ${id} SHOULD be recorded`);
  if (a.noMed) assert.strictEqual(d.medicationCandidate, null, `input ${a.n}: no medication candidate allowed`);
  if (a.medName) {
    assert.ok(d.medicationCandidate, `input ${a.n}: legitimate given-medication must be a candidate`);
    assert.strictEqual(d.medicationCandidate.name, a.medName, `input ${a.n}: candidate name`);
  }
  if ('category' in a) assert.strictEqual(d.category, a.category, `input ${a.n}: category`);
  passed++;
}
console.log(`adversarial dictations PASS — ${passed}/20 produce zero fact violations`);

/* Handoffs for the six real demo records */
const now = Date.parse('2026-10-31T15:00:00-05:00');
let handoffsChecked = 0;
for (const c of CASES) {
  const draft = Core.parseDictation(c.dictation);
  const rec = Core.buildRecord(draft, { confirmMedication: c.confirmMedication }, {
    online: c.online, recordId: 'hd-' + c.id,
    createdAt: new Date(now - 3600000).toISOString(), confirmedAt: new Date(now - 1800000).toISOString()
  });
  const h = Core.buildHandoff(rec, now);
  const v = Core.validateHandoff(h);
  assert.deepStrictEqual(v, [], `case ${c.id} handoff violations: ${v.join(' | ')}`);
  assert.ok(!/insulin/i.test(h.text), `case ${c.id} handoff must not contain unconfirmed items`);
  if (c.id === 1) assert.ok(/Morphine 4 mg IV/.test(h.text), 'case 1 handoff carries the confirmed medication');
  if (c.id === 2) assert.ok(/will relay when a connection is available/.test(h.text), 'case 2 handoff carries the queued status');
  handoffsChecked++;
}
console.log(`handoffs PASS — ${handoffsChecked}/6 restate confirmed facts only, zero advice language`);
console.log('\nGATE D: PASS — 20 adversarial inputs, 6 handoffs, 0 violations');
