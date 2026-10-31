/* AidRelay — core logic (Phase 1)
   Deterministic local structuring for scripted/demo dictations.
   Law (RELAYMASTER): the responder states facts; this code only sorts
   stated words into the locked schema. It never adds a fact, a category,
   or a care item that was not stated. AI output, when added later, must
   pass the same validation and remains a draft until confirmed. */
(function (global) {
  'use strict';

  var CATEGORIES = {
    GREEN: { label: 'Minor', rank: 2 },
    YELLOW: { label: 'Delayed', rank: 1 },
    RED: { label: 'Immediate', rank: 0 },
    BLACK: { label: 'Expectant', rank: 3 }
  };

  /* Frozen fixed care list — casualty-relay-schema.md §3. Order matters:
     careGiven arrays are stored in this order. */
  var CARE_LIST = [
    { id: 'tourniquet_applied', label: 'Tourniquet applied', pattern: /tourniquet (applied|is on)\b/i },
    { id: 'direct_pressure', label: 'Direct pressure applied', pattern: /direct pressure (applied|held)\b/i },
    { id: 'wound_packed', label: 'Wound packed', pattern: /wound packed|packed the wound/i },
    { id: 'hemostatic_dressing', label: 'Hemostatic dressing applied', pattern: /hemostatic dressing/i },
    { id: 'airway_positioned', label: 'Airway positioned', pattern: /airway positioned|airway positioning/i },
    { id: 'oxygen_applied', label: 'Oxygen applied', pattern: /oxygen (applied|on)\b/i },
    { id: 'iv_started', label: 'IV started', pattern: /\bIV (started|was started)\b/i },
    { id: 'io_started', label: 'IO started', pattern: /\bIO (started|was started)\b/i },
    { id: 'medication_given', label: 'Medication given — responder-confirmed details', pattern: null },
    { id: 'fluids_started', label: 'Fluids started', pattern: /fluids (started|running)\b/i },
    { id: 'splint_applied', label: 'Splint applied', pattern: /splint applied\b/i },
    { id: 'chest_seal_applied', label: 'Chest seal applied', pattern: /chest seal applied\b/i },
    { id: 'cpr_in_progress', label: 'CPR in progress', pattern: /\bCPR in progress\b/i },
    { id: 'aed_applied', label: 'AED applied', pattern: /\bAED applied\b/i },
    { id: 'kept_warm', label: 'Kept warm / blanket applied', pattern: /blanket (applied|wrapped)|kept (him |her |them )?warm/i },
    { id: 'moved_to_collection', label: 'Moved to casualty collection point', pattern: /moved to (the )?casualty collection point/i },
    { id: 'no_care_given', label: 'No care given yet', pattern: /no care given/i }
  ];

  var MED_LEXICON = ['morphine', 'insulin', 'epinephrine', 'ketamine', 'fentanyl', 'naloxone', 'aspirin', 'albuterol', 'ondansetron', 'midazolam'];
  var HEDGE = /somebody said|someone said|i think|didn'?t see|did not see|probably|maybe|not sure|i guess/i;
  /* A sentence telling someone to do something is not a completed action.
     Instruction sentences never produce care items, medication candidates,
     or narrative — in any field, ever. */
  var INSTRUCTION = /\bshould\b|\bneeds?\b|\bmust\b|\bought to\b|\bapply\b|\bgive (him|her|them|me)\b|\bstart (cpr|an? iv|oxygen|tourniquet)\b/i;

  var LOCATION_LEXICON = [
    { pattern: /fairground north gate/i, label: 'Fairground north gate' },
    { pattern: /casualty collection point/i, label: 'Casualty collection point' },
    { pattern: /first aid tent/i, label: 'First aid tent' },
    { pattern: /food stands/i, label: 'Food stands' },
    { pattern: /show ring/i, label: 'Show ring' },
    { pattern: /expectant area/i, label: 'Grandstand, expectant area' },
    { pattern: /grandstand/i, label: 'Grandstand' }
  ];

  /* Phrases that carry structured facts and are stripped from the narrative. */
  var STRIP_PHRASES = [
    /tourniquet applied( to the [^,;.]+)?/gi,
    /direct pressure applied/gi,
    /wound packed/gi,
    /hemostatic dressing applied/gi,
    /airway positioned/gi,
    /oxygen applied/gi,
    /\bIV started\b/gi,
    /\bIO started\b/gi,
    /fluids started/gi,
    /splint applied/gi,
    /chest seal applied/gi,
    /\bCPR in progress\b/gi,
    /\bAED applied\b/gi,
    /moved to (the )?casualty collection point/gi,
    /no care given yet/gi,
    /tourniquet is on( [^,;.]+)?/gi,
    /fluids running/gi,
    /\bIV was started\b/gi,
    /\bIO was started\b/gi,
    /direct pressure held/gi
  ];

  function cleanText(s) {
    return s.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/^[\s,;.—-]+/, '').replace(/[,;\s]+$/, '').trim();
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function findMedication(sentence) {
    var lower = sentence.toLowerCase();
    for (var i = 0; i < MED_LEXICON.length; i++) {
      if (lower.indexOf(MED_LEXICON[i]) !== -1) return MED_LEXICON[i];
    }
    return null;
  }

  function parseDictation(text) {
    var draft = {
      rawText: text,
      tag: null,
      category: null,
      careGiven: [],
      medicationCandidate: null,
      unconfirmedItems: [],
      narrativeDraft: '',
      locationLabel: null
    };
    if (!text) return draft;

    var tagMatch = text.match(/tag\s+([a-z]+-?\d+)/i);
    if (tagMatch) draft.tag = tagMatch[1].toUpperCase();

    var catMatch = text.match(/\b(red|yellow|green|black)\b/i) || text.match(/\b(immediate|delayed|minor|expectant)\b/i);
    if (catMatch) {
      var w = catMatch[1].toLowerCase();
      draft.category = { red: 'RED', immediate: 'RED', yellow: 'YELLOW', delayed: 'YELLOW', green: 'GREEN', minor: 'GREEN', black: 'BLACK', expectant: 'BLACK' }[w];
    }

    for (var li = 0; li < LOCATION_LEXICON.length; li++) {
      if (LOCATION_LEXICON[li].pattern.test(text)) { draft.locationLabel = LOCATION_LEXICON[li].label; break; }
    }

    var sentences = text.split(/(?<=[.])\s+/).filter(function (x) { return x.trim().length > 0; });
    var careFound = {};
    var narrativeParts = [];

    sentences.forEach(function (sentence) {
      var s = sentence.trim();
      var isInstruction = INSTRUCTION.test(s);

      if (!isInstruction) {
        CARE_LIST.forEach(function (item) {
          if (item.pattern && item.pattern.test(s)) careFound[item.id] = true;
        });
      }

      if (/^tag\s/i.test(s)) return;
      if (/confirm that back/i.test(s)) return;
      if (/no signal/i.test(s)) return;
      if (/^\s*(red|yellow|green|black)\s*,?\s*(immediate|delayed|minor|expectant)?\s*\.?$/i.test(s)) return;
      if (/^(he['’]s|she['’]s|he is|she is) at the/i.test(s)) return;
      if (/^kept with the/i.test(s)) return;
      if (isInstruction) return;

      var med = findMedication(s);
      if (med) {
        var doseMatch = s.match(/(\d+(?:\.\d+)?)\s*(milligrams|mg|units|mcg|micrograms)/i);
        var routeMatch = s.match(/\b(IV|IM|oral|IN)\b/);
        var hedged = HEDGE.test(s) || /some\s+\w+\s+(earlier|before)/i.test(s);
        if (doseMatch && !hedged && /\bgiven\b|\badministered\b/i.test(s)) {
          var dose = doseMatch[1] + ' ' + (doseMatch[2].toLowerCase() === 'milligrams' ? 'mg' : doseMatch[2].toLowerCase());
          draft.medicationCandidate = { name: med, dose: dose, route: routeMatch ? routeMatch[1].toUpperCase() : null, sourceText: s };
        } else {
          draft.unconfirmedItems.push({
            kind: 'medication',
            text: capitalize(med) + ' — mentioned but not confirmed',
            ambiguous: true,
            reason: hedged ? 'Stated second-hand or with uncertainty. It cannot be confirmed from this dictation.' : 'Not stated as care already given, with a clear dose. It cannot be confirmed from this dictation.'
          });
        }
        return;
      }

      var residual = s;
      STRIP_PHRASES.forEach(function (re) { residual = residual.replace(re, ''); });
      residual = cleanText(residual.replace(/\.$/, ''));
      if (residual.split(/\s+/).filter(Boolean).length >= 3) narrativeParts.push(capitalize(residual));
    });

    draft.careGiven = CARE_LIST.map(function (c) { return c.id; }).filter(function (id) { return careFound[id]; });
    draft.narrativeDraft = narrativeParts.join('. ') ? narrativeParts.join('. ') + '.' : '';
    return draft;
  }

  /* Confirmation turns a Draft into a Record. Unconfirmed items and
     unconfirmed medication candidates NEVER cross this line. */
  function buildRecord(draft, decisions, ctx) {
    decisions = decisions || {};
    ctx = ctx || {};
    var care = draft.careGiven.slice();
    var medications = [];
    if (draft.medicationCandidate && decisions.confirmMedication === true) {
      medications.push({
        name: draft.medicationCandidate.name,
        dose: draft.medicationCandidate.dose,
        route: draft.medicationCandidate.route,
        confirmedAt: ctx.confirmedAt || null
      });
      if (care.indexOf('medication_given') === -1) {
        /* keep frozen-list order */
        var order = CARE_LIST.map(function (c) { return c.id; });
        care.push('medication_given');
        care.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      }
    }
    return {
      recordId: ctx.recordId || 'local-' + Math.random().toString(36).slice(2, 10),
      incidentId: ctx.incidentId || 'DEMO-01',
      tag: decisions.tag || draft.tag,
      category: decisions.category || draft.category,
      careGiven: (decisions.careGiven || care),
      medications: medications,
      narrative: (decisions.narrative != null ? decisions.narrative : draft.narrativeDraft) || '',
      location: draft.locationLabel ? { lat: null, lon: null, label: draft.locationLabel, source: 'manual', approximate: false } : null,
      createdAt: ctx.createdAt || null,
      confirmedAt: ctx.confirmedAt || null,
      confirmationState: 'confirmed',
      syncState: ctx.online === false ? 'queued' : 'relayed',
      duplicateOf: null
    };
  }

  function sortBoard(records) {
    return records.slice().sort(function (a, b) {
      var ra = CATEGORIES[a.category] ? CATEGORIES[a.category].rank : 9;
      var rb = CATEGORIES[b.category] ? CATEGORIES[b.category].rank : 9;
      if (ra !== rb) return ra - rb;
      return String(a.confirmedAt || '').localeCompare(String(b.confirmedAt || ''));
    });
  }

  /* Handoff: a restatement of confirmed facts only. Template-generated.
     The narrative line is the responder's own words, quoted and labeled —
     the validator never scans the quote; it scans what the app itself says. */
  var HANDOFF_BANNED = /\b(should|needs?|recommend\w*|likely|suggests?|priority|treat\w*|diagnos\w*|therefore|must)\b/i;
  function careLabel(id) {
    for (var i = 0; i < CARE_LIST.length; i++) if (CARE_LIST[i].id === id) return CARE_LIST[i].label;
    return id;
  }
  function formatElapsed(ms) {
    var mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return 'under a minute';
    if (mins < 60) return mins + (mins === 1 ? ' minute' : ' minutes');
    var h = Math.floor(mins / 60), m = mins % 60;
    return h + (h === 1 ? ' hour' : ' hours') + (m ? ' ' + m + ' min' : '');
  }
  function buildHandoff(record, nowMs) {
    var lines = [];
    lines.push('HANDOFF — ' + record.tag);
    var c = CATEGORIES[record.category];
    lines.push('Category: ' + record.category + (c ? ' (' + c.label + ')' : '') + ' — stated by the responder.');
    if (record.confirmedAt) {
      var when = new Date(record.confirmedAt);
      lines.push('Confirmed at ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + formatElapsed((nowMs || Date.now()) - when.getTime()) + ' ago).');
    }
    lines.push('Location: ' + (record.location && record.location.label ? record.location.label : 'Not set.'));
    lines.push('Care already given: ' + (record.careGiven.length ? record.careGiven.map(careLabel).join('; ') + '.' : 'None recorded.'));
    (record.medications || []).forEach(function (m) {
      lines.push('Medication (responder-confirmed): ' + capitalize(m.name) + ' ' + m.dose + (m.route ? ' ' + m.route : '') + '.');
    });
    var quoteIndex = -1;
    if (record.narrative) { quoteIndex = lines.length; lines.push('Responder\u2019s words: \u201C' + record.narrative + '\u201D'); }
    lines.push(record.syncState === 'queued' ? 'Status: On this phone — will relay when a connection is available.' : 'Status: Relayed to the dispatch board.');
    return { lines: lines, quoteIndex: quoteIndex, text: lines.join('\n') };
  }
  function validateHandoff(handoff) {
    var violations = [];
    handoff.lines.forEach(function (line, i) {
      if (i === handoff.quoteIndex) return;
      if (HANDOFF_BANNED.test(line)) violations.push(line);
    });
    return violations;
  }

  /* ---------- AI draft validation (the Meta AI path's gate) ----------
     An AI-structured draft is guilty until proven innocent. Every fact in
     it must trace to the transcript, checked against the deterministic
     local parse of the same words. Any violation rejects the WHOLE draft;
     the app falls back to the local parse. The responder still confirms
     whatever survives — validation never creates a record by itself. */
  var AI_ALLOWED_KEYS = ['tag', 'category', 'careGiven', 'medications', 'narrative', 'locationLabel'];
  var AI_BANNED = /\b(should|recommend\w*|diagnos\w*|treatment|advise|advice)\b/i;

  function parseAiContent(text) {
    if (!text) return null;
    var t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function validateAiDraft(ai, transcript) {
    var reasons = [], warnings = [];
    if (!ai || typeof ai !== 'object') return { ok: false, reasons: ['AI output was not a JSON object.'], warnings: warnings, draft: null };
    Object.keys(ai).forEach(function (k) {
      if (AI_ALLOWED_KEYS.indexOf(k) === -1) reasons.push('AI added a field that does not exist in the schema: "' + k + '".');
    });
    var local = parseDictation(transcript);

    if (ai.tag != null && local.tag && String(ai.tag).toUpperCase() !== local.tag) reasons.push('AI tag "' + ai.tag + '" does not match the stated tag "' + local.tag + '".');
    if (ai.category != null && !CATEGORIES[ai.category]) reasons.push('AI category "' + ai.category + '" is not a START category.');
    if (ai.category != null && local.category && ai.category !== local.category) reasons.push('AI category ' + ai.category + ' does not match the stated category ' + local.category + '.');
    if (ai.category != null && !local.category) reasons.push('AI assigned category ' + ai.category + ' that the responder never stated.');
    if (ai.category == null && local.category) warnings.push('AI missed the stated category; the local read supplied it.');

    var careIds = {};
    CARE_LIST.forEach(function (c) { careIds[c.id] = true; });
    var aiCare = Array.isArray(ai.careGiven) ? ai.careGiven : [];
    aiCare.forEach(function (id) {
      if (!careIds[id]) reasons.push('AI used a care item that is not on the fixed list: "' + id + '".');
      else if (id !== 'medication_given' && local.careGiven.indexOf(id) === -1) reasons.push('AI recorded "' + id + '" but the dictation does not state it as care already given.');
    });
    local.careGiven.forEach(function (id) {
      if (aiCare.indexOf(id) === -1) warnings.push('AI missed a stated care item (' + id + '); the local read supplied it.');
    });

    var aiMeds = Array.isArray(ai.medications) ? ai.medications : [];
    var candidate = null;
    if (aiMeds.length) {
      if (!local.medicationCandidate) {
        reasons.push('AI recorded a medication the dictation does not state as given, with a clear dose.');
      } else {
        var m = aiMeds[0];
        var normDose = function (d) { return String(d || '').toLowerCase().replace(/milligrams/g, 'mg').replace(/micrograms/g, 'mcg').replace(/\s+/g, ' ').trim(); };
        if (!m || String(m.name || '').toLowerCase() !== local.medicationCandidate.name || normDose(m.dose) !== normDose(local.medicationCandidate.dose)) {
          reasons.push('AI medication does not match the stated medication (' + local.medicationCandidate.name + ' ' + local.medicationCandidate.dose + ').');
        } else {
          candidate = local.medicationCandidate;
        }
      }
    }
    if (!candidate && local.medicationCandidate) { candidate = local.medicationCandidate; warnings.push('AI missed the stated medication; the local read supplied it for read-back.'); }

    var narrative = typeof ai.narrative === 'string' ? ai.narrative : '';
    if (AI_BANNED.test(narrative)) reasons.push('AI narrative contains advice, diagnosis, or treatment language.');
    if (narrative) {
      var tWords = {};
      transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(function (w) { if (w) tWords[w] = true; });
      var nWords = narrative.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
      var hits = nWords.filter(function (w) { return tWords[w]; }).length;
      if (nWords.length && hits / nWords.length < 0.7) reasons.push('AI narrative uses words that are not in the dictation (possible invented facts).');
    }

    if (ai.locationLabel != null) {
      var aiLoc = String(ai.locationLabel);
      var matchesLocal = local.locationLabel && aiLoc.toLowerCase() === local.locationLabel.toLowerCase();
      var inTranscript = transcript.toLowerCase().indexOf(aiLoc.toLowerCase()) !== -1;
      if (!matchesLocal && !inTranscript) reasons.push('AI location "' + aiLoc + '" does not appear in the dictation.');
    }

    if (narrative) {
      var vocab = { red: 1, yellow: 1, green: 1, black: 1, immediate: 1, delayed: 1, minor: 1, expectant: 1, tag: 1 };
      var words = narrative.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      if (words.length && words.every(function (w) { return vocab[w]; })) { narrative = ''; warnings.push('AI narrative was only category words; the local read supplied the narrative.'); }
    }
    if (reasons.length) return { ok: false, reasons: reasons, warnings: warnings, draft: null };
    var mergedCare = local.careGiven.slice();
    aiCare.forEach(function (id) { if (id !== 'medication_given' && mergedCare.indexOf(id) === -1) mergedCare.push(id); });
    mergedCare = CARE_LIST.map(function (c) { return c.id; }).filter(function (id) { return mergedCare.indexOf(id) !== -1; });
    return {
      ok: true, reasons: [], warnings: warnings,
      draft: {
        rawText: transcript,
        tag: local.tag || (ai.tag ? String(ai.tag).toUpperCase() : null),
        category: local.category || ai.category || null,
        careGiven: mergedCare,
        medicationCandidate: candidate,
        unconfirmedItems: local.unconfirmedItems,
        narrativeDraft: narrative || local.narrativeDraft,
        locationLabel: local.locationLabel || ai.locationLabel || null,
        source: 'meta-ai'
      }
    };
  }

  var api = { CATEGORIES: CATEGORIES, CARE_LIST: CARE_LIST, parseDictation: parseDictation, buildRecord: buildRecord, sortBoard: sortBoard, buildHandoff: buildHandoff, validateHandoff: validateHandoff, formatElapsed: formatElapsed, parseAiContent: parseAiContent, validateAiDraft: validateAiDraft };
  global.RelayCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
