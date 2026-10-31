/* Validate the live Spark outputs saved by meta_smoke.py through the
   exact gate the app uses (parseAiContent + validateAiDraft). */
const Core = require('../relay-core.js');
const CASES = require('../demo-data.js');
const results = require('./smoke-results.json');

let summary = [];
function check(name, transcript, expect) {
  const r = results[name];
  if (!r || r.error) { summary.push(name + ': API ERROR ' + (r && r.error)); return; }
  const ai = Core.parseAiContent(r.raw);
  if (!ai) { summary.push(name + ': UNPARSEABLE OUTPUT — app would fall back to local parse'); return; }
  const v = Core.validateAiDraft(ai, transcript);
  if (!v.ok) { summary.push(name + ': AI DRAFT REJECTED by the gate — ' + v.reasons.join(' ') + ' (app falls back to local parse)'); return; }
  let line = name + ': AI draft ACCEPTED';
  if (expect) {
    const problems = [];
    if (v.draft.tag !== expect.tag) problems.push('tag ' + v.draft.tag + ' != ' + expect.tag);
    if (v.draft.category !== expect.category) problems.push('category ' + v.draft.category + ' != ' + expect.category);
    if (JSON.stringify(v.draft.careGiven) !== JSON.stringify(expect.careGiven.filter(id => id !== 'medication_given'))) problems.push('care ' + JSON.stringify(v.draft.careGiven));
    const medOk = expect.medicationCount === 0 ? v.draft.medicationCandidate === null : !!v.draft.medicationCandidate;
    if (!medOk) problems.push('medication candidate mismatch');
    line += problems.length ? ' but FIELD MISMATCHES: ' + problems.join('; ') : ' — fields match the expected record';
    if (v.warnings.length) line += ' (warnings: ' + v.warnings.join(' ') + ')';
  }
  summary.push(line);
}

for (const c of CASES) check('case' + c.id, c.dictation, c.expected);
check('adv3', results.adv3.transcript, null);
check('adv10', results.adv10.transcript, null);
check('adv14', results.adv14.transcript, null);
for (const name of ['adv3', 'adv10', 'adv14']) {
  const r = results[name];
  const ai = r && Core.parseAiContent(r.raw);
  if (ai) summary.push(name + ' raw AI output: ' + JSON.stringify(ai));
}
summary.forEach(l => console.log(l));
