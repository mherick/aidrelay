/* AidRelay — capture UI (Phase 1)
   Screens: home → capture → confirm → saved.
   All structuring goes through RelayCore; nothing is saved before confirm. */
(function () {
  'use strict';
  var Core = window.RelayCore;
  var CASES = window.RelayDemoData;
  var Storage = window.RelayStorage;
  var store = null, transport = null, queue = null;
  var recordsCache = [];

  var $ = function (id) { return document.getElementById(id); };
  var screens = ['screen-home', 'screen-capture', 'screen-confirm', 'screen-saved', 'screen-board', 'screen-handoff'];
  function show(id) {
    screens.forEach(function (s) { $(s).hidden = s !== id; });
    if (id === 'screen-home') renderRecords();
    window.scrollTo(0, 0);
  }
  function isOnline() { return !$('offlineToggle').checked && navigator.onLine !== false; }
  function loadRecords() { return recordsCache; }
  async function saveRecords(rs) { recordsCache = rs; await store.saveAll(rs); }
  async function flushQueue() {
    if (!queue || !isOnline()) return;
    await queue.flush();
    recordsCache = await store.loadAll();
    renderRecords();
  }
  function catChip(cat) {
    var c = Core.CATEGORIES[cat];
    return '<span class="catchip cat-' + cat + '">' + cat + (c ? ' — ' + c.label : '') + '</span>';
  }
  function syncWords(r) {
    return r.syncState === 'queued' ? 'No signal. Saved on this phone. It will send later.' : 'Sent to the dispatch board.';
  }
  function careLabels(ids) {
    return ids.map(function (id) {
      var item = Core.CARE_LIST.find(function (c) { return c.id === id; });
      return item ? item.label : id;
    });
  }

  function renderRecords() {
    var rs = Core.sortBoard(loadRecords());
    if (!rs.length) { $('recordList').innerHTML = '<p class="hint">No records yet.</p>'; return; }
    $('recordList').innerHTML = rs.map(function (r) {
      return '<div class="record">' + catChip(r.category) +
        '<strong>' + r.tag + '</strong>' +
        '<span class="recmeta">' + (r.location ? r.location.label : 'Location not set') + '</span>' +
        '<span class="recmeta">' + syncWords(r) + '</span></div>';
    }).join('');
  }

  /* ---------- category + care pickers ---------- */
  function buildCategories(el, selected, onPick) {
    el.innerHTML = '';
    Object.keys(Core.CATEGORIES).forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'catbtn cat-' + cat + (cat === selected ? ' sel' : '');
      b.textContent = cat + ' — ' + Core.CATEGORIES[cat].label;
      b.addEventListener('click', function () { onPick(cat); });
      el.appendChild(b);
    });
  }
  function buildCare(el, selectedSet, onToggle) {
    el.innerHTML = '';
    Core.CARE_LIST.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (selectedSet.has(item.id) ? ' sel' : '');
      b.textContent = item.label;
      b.addEventListener('click', function () { onToggle(item.id); });
      el.appendChild(b);
    });
  }

  /* ---------- capture: manual entry state ---------- */
  var mCategory = null;
  var mCare = new Set();
  function refreshManual() {
    buildCategories($('mCategories'), mCategory, function (c) { mCategory = c; refreshManual(); });
    buildCare($('mCare'), mCare, function (id) { mCare.has(id) ? mCare.delete(id) : mCare.add(id); refreshManual(); });
  }

  /* ---------- confirm screen state ---------- */
  var draft = null;
  var cCategory = null;
  var cCare = new Set();
  var medConfirmed = false;

  function openConfirm(d) {
    draft = d;
    cCategory = d.category;
    cCare = new Set(d.careGiven);
    medConfirmed = false;
    $('cTag').value = d.tag || '';
    $('cNarrative').value = d.narrativeDraft || '';
    $('cLocation').value = d.locationLabel || '';
    refreshConfirm();

    if (d.medicationCandidate) {
      var m = d.medicationCandidate;
      $('medCard').hidden = false;
      $('medText').textContent = capitalize(m.name) + ' — ' + m.dose + (m.route ? ' — ' + m.route : '');
      $('medState').textContent = 'Not confirmed yet.';
    } else { $('medCard').hidden = true; }

    if (d.unconfirmedItems && d.unconfirmedItems.length) {
      $('unconfCard').hidden = false;
      $('unconfList').innerHTML = d.unconfirmedItems.map(function (u) {
        return '<p class="unconfitem"><strong>' + u.text + '</strong><br><span class="hint">' + u.reason + '</span></p>';
      }).join('');
    } else { $('unconfCard').hidden = true; }

    show('screen-confirm');
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function refreshConfirm() {
    buildCategories($('cCategories'), cCategory, function (c) { cCategory = c; refreshConfirm(); });
    buildCare($('cCare'), cCare, function (id) { cCare.has(id) ? cCare.delete(id) : cCare.add(id); refreshConfirm(); });
  }

  /* ---------- wiring ---------- */
  $('startBtn').addEventListener('click', function () { show('screen-capture'); });
  document.querySelectorAll('.backHome').forEach(function (b) { b.addEventListener('click', function () { show('screen-home'); }); });
  $('clearBtn').addEventListener('click', async function () { await saveRecords([]); store.clear(); renderRecords(); });
  $('offlineToggle').addEventListener('change', function () { renderRecords(); flushQueue(); });
  window.addEventListener('online', flushQueue);

  $('tabDictation').addEventListener('click', function () {
    $('tabDictation').classList.add('active'); $('tabType').classList.remove('active');
    $('paneDictation').hidden = false; $('paneType').hidden = true;
  });
  $('tabType').addEventListener('click', function () {
    $('tabType').classList.add('active'); $('tabDictation').classList.remove('active');
    $('paneType').hidden = false; $('paneDictation').hidden = true; refreshManual();
  });

  $('caseList').innerHTML = '';
  CASES.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'casebtn';
    b.textContent = 'Case ' + c.id + ' · ' + c.tag + ' — ' + c.title;
    b.addEventListener('click', function () {
      $('dictationText').value = c.dictation;
      $('offlineToggle').checked = !c.online;
    });
    $('caseList').appendChild(b);
  });

  /* ---------- structuring mode: on-device vs Meta AI (live) ---------- */
  var metaMode = false;
  function setMode(meta) {
    metaMode = meta;
    $('modeLocal').classList.toggle('active', !meta);
    $('modeMeta').classList.toggle('active', meta);
    $('metaKeyRow').hidden = !meta;
  }
  $('modeLocal').addEventListener('click', function () { setMode(false); });
  $('modeMeta').addEventListener('click', function () { setMode(true); });
  $('metaKey').value = window.RelayMeta.getKey();
  $('metaKey').addEventListener('change', function () { window.RelayMeta.setKey($('metaKey').value.trim()); });
  $('showKey').addEventListener('change', function () { $('metaKey').type = $('showKey').checked ? 'text' : 'password'; });

  function openConfirmNoted(d, notice) {
    openConfirm(d);
    if (notice) { $('aiNotice').hidden = false; $('aiNotice').textContent = notice; }
    else { $('aiNotice').hidden = true; }
  }

  $('audioFile').addEventListener('change', async function () {
    var f = $('audioFile').files && $('audioFile').files[0];
    if (!f) return;
    if (!metaMode) { $('micMsg').textContent = 'Recordings are transcribed in Meta AI (live) mode — switch at the top, add your key, then pick the recording.'; return; }
    var key = window.RelayMeta.getKey();
    if (!key) { $('micMsg').textContent = 'The microphone uses Meta AI transcription — paste your Meta Model API key above first.'; setMode(true); return; }
    $('micMsg').textContent = 'Transcribing your recording…';
    try {
      var text = await window.RelayMeta.transcribeAudio(f, key);
      $('dictationText').value = text;
      $('micMsg').textContent = 'Transcript filled in from your recording. Check it, then tap “Read it back for confirmation.”';
    } catch (err) {
      $('micMsg').textContent = 'That recording did not transcribe (' + err.message + '). You can type the dictation instead.';
    }
    $('audioFile').value = '';
  });

  $('parseBtn').addEventListener('click', async function () {
    var text = $('dictationText').value.trim();
    if (!text) { alert('Add the responder\u2019s dictation first.'); return; }
    $('aiReject').hidden = true;
    if (!metaMode) { openConfirmNoted(Core.parseDictation(text), null); return; }
    var key = window.RelayMeta.getKey();
    if (!key) { alert('Live mode needs your Meta Model API key. Paste it above first — it stays in this browser.'); return; }
    $('parseBtn').textContent = 'Reading with Meta AI…';
    try {
      var ai = await window.RelayMeta.structureWithSpark(text, key);
      var v = Core.validateAiDraft(ai, text);
      if (v.ok) {
        openConfirmNoted(v.draft, 'Structured by Meta AI (Muse Spark) and checked against the responder\u2019s exact words — every item below traces to the dictation.' + (v.warnings.length ? ' Notes: ' + v.warnings.join(' ') : ''));
      } else {
        $('aiReject').hidden = false;
        $('aiReject').textContent = 'Meta AI\u2019s draft was rejected: ' + v.reasons.join(' ') + ' Showing the on-device read instead.';
        openConfirmNoted(Core.parseDictation(text), null);
      }
    } catch (e) {
      $('aiReject').hidden = false;
      $('aiReject').textContent = 'Meta AI could not be reached (' + e.message + '). Showing the on-device read instead.';
      openConfirmNoted(Core.parseDictation(text), null);
    } finally {
      $('parseBtn').textContent = 'Read it back for confirmation';
    }
  });

  /* ---------- microphone: Muse Voice Transcribe (live mode) ---------- */
  var recorder = null, chunks = [];
  $('micBtn').addEventListener('click', async function () {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    var key = window.RelayMeta.getKey();
    if (!key) { $('micMsg').textContent = 'The microphone uses Meta AI transcription — paste your Meta Model API key above first.'; setMode(true); return; }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (ev) { chunks.push(ev.data); };
      recorder.onstop = async function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        $('micBtn').textContent = 'Record a dictation';
        $('micMsg').textContent = 'Transcribing with Meta AI…';
        try {
          var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          var transcript = await window.RelayMeta.transcribeAudio(blob, key);
          $('dictationText').value = transcript;
          $('micMsg').textContent = 'Transcript ready — check it, then read it back for confirmation.';
        } catch (e) {
          $('micMsg').textContent = 'Transcription did not come back (' + e.message + '). You can type the dictation instead.';
        }
      };
      recorder.start();
      $('micBtn').textContent = 'Stop recording';
      $('micMsg').textContent = 'Recording… tap Stop when the dictation is done.';
    } catch (e) {
      $('micMsg').textContent = 'This browser blocks the microphone on this address — browsers only allow it on a secure (https) address or on this computer itself (127.0.0.1). On the phone, dictate into Voice Memos and use “Or use a recording” below instead.';
    }
  });

  $('manualBtn').addEventListener('click', function () {
    openConfirm({
      rawText: '', tag: $('mTag').value.trim().toUpperCase() || null, category: mCategory,
      careGiven: Array.from(mCare), medicationCandidate: null, unconfirmedItems: [],
      narrativeDraft: $('mNarrative').value.trim(), locationLabel: $('mLocation').value.trim() || null
    });
  });

  $('medYes').addEventListener('click', function () {
    medConfirmed = true;
    $('medState').textContent = 'Confirmed by the responder. It will be saved on the record.';
  });
  $('medNo').addEventListener('click', function () {
    medConfirmed = false;
    if (draft) draft.medicationCandidate = null;
    $('medCard').hidden = true;
  });

  $('confirmBtn').addEventListener('click', async function () {
    if (!draft) return;
    var tag = $('cTag').value.trim().toUpperCase();
    if (!tag) { alert('The record needs a tag or code name.'); return; }
    if (!cCategory) { alert('The responder must state a category.'); return; }
    var now = new Date();
    var decisions = {
      tag: tag, category: cCategory,
      careGiven: Core.CARE_LIST.map(function (c) { return c.id; }).filter(function (id) { return cCare.has(id); }),
      narrative: $('cNarrative').value.trim(),
      confirmMedication: medConfirmed
    };
    var rec = Core.buildRecord(draft, decisions, {
      online: isOnline(), createdAt: new Date(now - 60000).toISOString(), confirmedAt: now.toISOString()
    });
    var loc = $('cLocation').value.trim();
    rec.location = loc ? { lat: null, lon: null, label: loc, source: 'manual', approximate: false } : null;

    /* duplicate guard: same tag already on this phone */
    var rs = loadRecords();
    var existing = rs.findIndex(function (r) { return r.tag === rec.tag; });
    if (existing !== -1) {
      if (!window.confirm('A record with tag ' + rec.tag + ' is already saved. Replace it with this one?')) return;
      rec.duplicateOf = rs[existing].recordId;
      rs.splice(existing, 1);
    }
    rs.push(rec);
    await saveRecords(rs);
    if (rec.syncState === 'relayed' && transport) transport.deliver(rec);

    $('savedMsg').textContent = syncWords(rec);
    $('savedCard').innerHTML = '<div class="record">' + catChip(rec.category) + '<strong>' + rec.tag + '</strong>' +
      '<span class="recmeta">' + careLabels(rec.careGiven).join(' · ') + '</span>' +
      (rec.medications.length ? '<span class="recmeta">Medication confirmed: ' + rec.medications.map(function (m) { return capitalize(m.name) + ' ' + m.dose + (m.route ? ' ' + m.route : ''); }).join('; ') + '</span>' : '') +
      '</div>';
    show('screen-saved');
  });

  $('anotherBtn').addEventListener('click', function () { show('screen-capture'); });

  /* ---------- dispatch board + handoff ---------- */
  function renderBoard() {
    var rs = Core.sortBoard(loadRecords());
    var counts = { RED: 0, YELLOW: 0, GREEN: 0, BLACK: 0 };
    rs.forEach(function (r) { if (counts[r.category] !== undefined) counts[r.category]++; });
    $('boardCounts').innerHTML = ['RED', 'YELLOW', 'GREEN', 'BLACK'].map(function (c) {
      return '<span class="catchip cat-' + c + '">' + c + ' ' + counts[c] + '</span>';
    }).join('') + '<span class="counttotal">Total ' + rs.length + '</span>';
    if (!rs.length) { $('boardList').innerHTML = '<p class="hint">No casualties on the board yet.</p>'; return; }
    $('boardList').innerHTML = '';
    rs.forEach(function (r) {
      var div = document.createElement('div');
      div.className = 'record boardcard';
      var elapsed = r.confirmedAt ? Core.formatElapsed(Date.now() - Date.parse(r.confirmedAt)) : '';
      div.innerHTML = catChip(r.category) + '<strong>' + r.tag + '</strong>' +
        '<span class="recmeta">' + (r.location ? r.location.label : 'Location not set') + (elapsed ? ' · ' + elapsed + ' since confirmed' : '') + '</span>' +
        '<span class="recmeta">' + careLabels(r.careGiven).join(' · ') + '</span>' +
        '<span class="recmeta">' + syncWords(r) + '</span>';
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Handoff'; b.className = 'handoffbtn';
      b.addEventListener('click', function () {
        $('handoffText').textContent = Core.buildHandoff(r, Date.now()).text;
        show('screen-handoff');
      });
      div.appendChild(b);
      $('boardList').appendChild(div);
    });
  }
  var baseShow = show;
  show = function (id) { baseShow(id); if (id === 'screen-board') renderBoard(); };
  $('boardBtn').addEventListener('click', function () { show('screen-board'); });
  $('backBoard').addEventListener('click', function () { show('screen-board'); });
  setInterval(function () { if (!$('screen-board').hidden) renderBoard(); }, 30000);

  refreshManual();
  show('screen-home');
  (async function boot() {
    try {
      store = await new Storage.RelayStore(Storage.localStorageKV()).init();
      transport = new Storage.LocalBoardTransport();
      queue = new Storage.RelayQueue(store, transport);
      recordsCache = await store.loadAll();
      renderRecords();
      await flushQueue();
    } catch (e) {
      $('recordList').innerHTML = '<p class="hint">This browser could not open the encrypted record store.</p>';
    }
  })();
})();
