/* Gate E — the AI gate. Fabricated Spark outputs: honest ones pass,
   inventive ones are rejected wholesale with reasons. */
const assert = require('node:assert');
const Core = require('../relay-core.js');
const CASES = require('../demo-data.js');

const t1 = CASES[0].dictation; // R-07, morphine given
const good = { tag: 'R-07', category: 'RED', careGiven: ['tourniquet_applied', 'wound_packed', 'iv_started', 'medication_given'], medications: [{ name: 'morphine', dose: '4 mg', route: 'IV' }], narrative: 'Adult male, leg injury from the collapsed barn roof, fairground north gate.', locationLabel: 'Fairground north gate' };

let v = Core.validateAiDraft(good, t1);
assert.ok(v.ok, 'honest AI draft must pass: ' + v.reasons.join(' '));
assert.strictEqual(v.draft.medicationCandidate.name, 'morphine');
console.log('honest draft PASS — accepted, medication candidate preserved for read-back');

const inventions = [
  ['invented care item', Object.assign({}, good, { careGiven: good.careGiven.concat(['chest_seal_applied']) })],
  ['assigned a different category', Object.assign({}, good, { category: 'YELLOW' })],
  ['added a diagnosis field', Object.assign({}, good, { diagnosis: 'crush injury' })],
  ['invented a medication', Object.assign({}, good, { medications: [{ name: 'ketamine', dose: '20 mg', route: 'IV' }] })],
  ['advice in the narrative', Object.assign({}, good, { narrative: 'Adult male with a leg injury. He should receive fluids and be transported first.' })],
  ['invented narrative facts', Object.assign({}, good, { narrative: 'Three children were trapped inside the burning tractor shed near the river.' })],
  ['invented location', Object.assign({}, good, { locationLabel: 'County hospital helipad' })],
  ['care item not on the fixed list', Object.assign({}, good, { careGiven: ['applied_tourniquet_wrongly'] })]
];
for (const [name, ai] of inventions) {
  const r = Core.validateAiDraft(ai, t1);
  assert.ok(!r.ok, name + ' must be rejected');
  assert.ok(r.reasons.length >= 1, name + ' must carry a reason');
  console.log('rejected as required: ' + name + ' — ' + r.reasons[0]);
}

/* The trap case through the AI gate: an AI that "helpfully" records the
   second-hand insulin must be rejected; an AI that omits it passes, and
   the local unconfirmed item still surfaces for the responder. */
const t6 = CASES[5].dictation;
const helpful = { tag: 'Y-15', category: 'YELLOW', careGiven: ['iv_started', 'fluids_started', 'medication_given'], medications: [{ name: 'insulin', dose: '10 units', route: null }], narrative: 'Adult male, dizzy and sweating by the food stands.', locationLabel: 'Food stands' };
const r6 = Core.validateAiDraft(helpful, t6);
assert.ok(!r6.ok, 'AI recording the unconfirmed insulin must be rejected');
console.log('rejected as required: AI recorded the second-hand insulin — ' + r6.reasons[0]);

const honest6 = { tag: 'Y-15', category: 'YELLOW', careGiven: ['iv_started', 'fluids_started'], medications: [], narrative: 'Adult male, dizzy and sweating by the food stands.', locationLabel: 'Food stands' };
const v6 = Core.validateAiDraft(honest6, t6);
assert.ok(v6.ok, 'honest case-6 AI draft must pass');
assert.strictEqual(v6.draft.unconfirmedItems.length, 1, 'the insulin mention still surfaces as unconfirmed for the responder');
assert.strictEqual(v6.draft.medicationCandidate, null, 'no medication candidate in case 6');
console.log('honest case-6 draft PASS — insulin stays an unconfirmed mention, never a fact');

console.log('\nGATE E: PASS — honest AI drafts accepted, 9 inventive ones rejected wholesale');
