/* AidRelay — Meta AI live path (Phase 3.5)
   Uses the END USER's own Meta Model API key (entered in the app, kept in
   this browser's local storage — the same pattern as the Shichinin build).
   Nothing here is trusted on its own: Spark's structured output goes
   through RelayCore.validateAiDraft, and anything it gets wrong is
   rejected wholesale in favor of the on-device parse. */
(function (global) {
  'use strict';
  var API_URL = 'https://api.meta.ai/v1/chat/completions';
  var KEY_LS = 'relay.metaKey.v1';

  var STRUCTURING_PROMPT = "You structure spoken casualty reports into JSON for a documentation app used at civilian disaster scenes. You never give medical advice, never diagnose, and never recommend treatment. Output ONLY a JSON object with exactly these keys: tag, category, careGiven, medications, narrative, locationLabel.\n- tag: the code name or tag number the responder states (like \"R-07\"), or null.\n- category: one of GREEN, YELLOW, RED, BLACK — only the category the responder states, or null. Never choose one yourself.\n- careGiven: an array of IDs from this fixed list only: tourniquet_applied, direct_pressure, wound_packed, hemostatic_dressing, airway_positioned, oxygen_applied, iv_started, io_started, medication_given, fluids_started, splint_applied, chest_seal_applied, cpr_in_progress, aed_applied, kept_warm, moved_to_collection, no_care_given. Include an ID only when the responder states that action was ALREADY completed. If a sentence tells someone to do something, or asks what to do, record nothing from that sentence.\n- medications: an array of {name, dose, route} only when the responder states a medication was given with a clear dose. Otherwise an empty array. Never include a medication that was suggested, requested, mentioned second-hand, or stated uncertainly.\n- narrative: the responder's own descriptive words about what they saw, copied or lightly trimmed. Add no conclusions, no new facts, no medical terms they did not use.\n- locationLabel: the place the responder names, or null.";

  function getKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEY_LS, k); else localStorage.removeItem(KEY_LS); } catch (e) {} }

  async function callApi(apiKey, body) {
    /* When the app is served by the local server (server.py), Meta calls go
       through it on this machine — that path never depends on browser
       cross-origin behavior. Opened any other way, the call goes direct. */
    var viaLocal = /^https?:$/.test(window.location.protocol) && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
    var res;
    if (viaLocal) {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey, body: body })
      });
    } else {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify(body)
      });
    }
    if (!res.ok) throw new Error('Meta AI returned ' + res.status);
    var payload = await res.json();
    var msg = (payload.choices || [{}])[0].message || {};
    return msg.content || '';
  }

  async function structureWithSpark(transcript, apiKey) {
    var content = await callApi(apiKey, {
      model: 'muse-spark-1.3',
      reasoning_effort: 'minimal',
      temperature: 0,
      max_tokens: 900,
      messages: [
        { role: 'system', content: STRUCTURING_PROMPT },
        { role: 'user', content: transcript }
      ]
    });
    return global.RelayCore.parseAiContent(content);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /* Microphone transcription runs on muse-spark-1.2 — Meta's documented
     audio-understanding model — verified live Oct 30, 2026. The dedicated
     muse-voice-transcribe-1.0 is listed on the roster but returned
     model_not_found for this account on every endpoint probed
     (chat/completions, /v1/responses, /v1/audio/transcriptions).
     Recordings are converted to 16 kHz mono WAV in the browser first,
     because that is the format verified to work. */
  async function blobToWav16k(blob) {
    var arrayBuf = await blob.arrayBuffer();
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    var decoded = await ctx.decodeAudioData(arrayBuf);
    var samples = decoded.getChannelData(0);
    var ratio = decoded.sampleRate / 16000;
    var outLen = Math.floor(samples.length / ratio);
    var pcm = new Int16Array(outLen);
    for (var i = 0; i < outLen; i++) {
      var v = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    ctx.close();
    var buf = new ArrayBuffer(44 + pcm.length * 2);
    var view = new DataView(buf);
    function wstr(off, str) { for (var j = 0; j < str.length; j++) view.setUint8(off + j, str.charCodeAt(j)); }
    wstr(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); wstr(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); wstr(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (var k = 0; k < pcm.length; k++) view.setInt16(44 + k * 2, pcm[k], true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  async function transcribeAudio(blob, apiKey) {
    var wav = await blobToWav16k(blob);
    var data = await blobToBase64(wav);
    var content = await callApi(apiKey, {
      model: 'muse-spark-1.2',
      reasoning_effort: 'minimal',
      max_tokens: 1200,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Transcribe this audio exactly, word for word. Output only the transcript.' },
        { type: 'input_audio', input_audio: { data: data, format: 'wav' } }
      ] }]
    });
    return content.trim();
  }

  global.RelayMeta = { getKey: getKey, setKey: setKey, structureWithSpark: structureWithSpark, transcribeAudio: transcribeAudio, STRUCTURING_PROMPT: STRUCTURING_PROMPT };
})(typeof window !== 'undefined' ? window : globalThis);
