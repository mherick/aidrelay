/* AidRelay — encrypted on-device store + relay queue (Phase 2)
   Mechanism, stated exactly (RELAYMASTER §9): records are encrypted at rest
   with AES-GCM (WebCrypto). The device key is generated once and held in the
   browser's own storage on the same device — demo-grade key handling;
   a production build would use the platform keystore. Records are never
   stored as plaintext. The relay transport in this demo is local: the
   "dispatch board inbox" is a named seam (LocalBoardTransport) that a real
   backend can replace without touching capture or storage. */
(function (global) {
  'use strict';

  var RECORDS_KEY = 'relay.records.v2';
  var KEY_KEY = 'relay.key.v2';
  var subtle = (global.crypto && global.crypto.subtle) || null;

  function b64encode(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = '';
    bytes.forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function b64decode(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    var s = atob(str);
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  /* KV adapters: localStorage in the browser, Map in tests. */
  function localStorageKV() {
    return {
      get: function (k) { return localStorage.getItem(k); },
      set: function (k, v) { localStorage.setItem(k, v); },
      remove: function (k) { localStorage.removeItem(k); }
    };
  }
  function mapKV(map) {
    return {
      get: function (k) { return map.has(k) ? map.get(k) : null; },
      set: function (k, v) { map.set(k, v); },
      remove: function (k) { map.delete(k); }
    };
  }

  function RelayStore(kv) { this.kv = kv; this.key = null; }

  RelayStore.prototype.init = async function () {
    if (!subtle) throw new Error('WebCrypto is not available in this browser.');
    var saved = this.kv.get(KEY_KEY);
    if (saved) {
      this.key = await subtle.importKey('raw', b64decode(saved), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    } else {
      this.key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      var raw = await subtle.exportKey('raw', this.key);
      this.kv.set(KEY_KEY, b64encode(new Uint8Array(raw)));
    }
    return this;
  };

  RelayStore.prototype.encryptRecord = async function (record) {
    var iv = global.crypto.getRandomValues(new Uint8Array(12));
    var plain = new TextEncoder().encode(JSON.stringify(record));
    var cipher = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, this.key, plain);
    return { id: record.recordId, iv: b64encode(iv), data: b64encode(new Uint8Array(cipher)) };
  };

  RelayStore.prototype.decryptEnvelope = async function (env) {
    var plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64decode(env.iv) }, this.key, b64decode(env.data));
    return JSON.parse(new TextDecoder().decode(plain));
  };

  RelayStore.prototype.saveAll = async function (records) {
    var envelopes = [];
    for (var i = 0; i < records.length; i++) envelopes.push(await this.encryptRecord(records[i]));
    this.kv.set(RECORDS_KEY, JSON.stringify(envelopes));
  };

  RelayStore.prototype.loadAll = async function () {
    var raw = this.kv.get(RECORDS_KEY);
    if (!raw) return [];
    var envelopes = JSON.parse(raw);
    var out = [];
    for (var i = 0; i < envelopes.length; i++) out.push(await this.decryptEnvelope(envelopes[i]));
    return out;
  };

  RelayStore.prototype.clear = function () { this.kv.remove(RECORDS_KEY); };

  /* The dispatch-board inbox. Dedupe law:
     - Same recordId delivered again → ignored (idempotent relay).
     - Same tag, new recordId, duplicateOf pointing at the held record → update replaces it.
     - Same tag, new recordId, no duplicateOf → held as a conflict for a human decision;
       it never silently joins or replaces a board record. */
  function LocalBoardTransport() { this.inbox = new Map(); this.conflicts = []; }
  LocalBoardTransport.prototype.deliver = function (record) {
    if (this.inbox.has(record.recordId)) return 'duplicate-id';
    var byTag = null;
    this.inbox.forEach(function (r) { if (r.tag === record.tag) byTag = r; });
    if (byTag) {
      if (record.duplicateOf && record.duplicateOf === byTag.recordId) {
        this.inbox.delete(byTag.recordId);
        this.inbox.set(record.recordId, record);
        return 'tag-update';
      }
      this.conflicts.push(record);
      return 'tag-conflict';
    }
    this.inbox.set(record.recordId, record);
    return 'accepted';
  };
  LocalBoardTransport.prototype.board = function () { return Array.from(this.inbox.values()); };

  /* The queue: persists records through the store; flush delivers every
     queued record and marks it relayed (duplicates count as delivered —
     the fact was already received). Conflicts stay queued and visible. */
  function RelayQueue(store, transport) { this.store = store; this.transport = transport; }
  RelayQueue.prototype.flush = async function () {
    var records = await this.store.loadAll();
    var results = [];
    var changed = false;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.syncState !== 'queued') continue;
      var outcome = this.transport.deliver(r);
      results.push({ recordId: r.recordId, tag: r.tag, outcome: outcome });
      if (outcome !== 'tag-conflict') { r.syncState = 'relayed'; changed = true; }
    }
    if (changed) await this.store.saveAll(records);
    return results;
  };

  var api = { RelayStore: RelayStore, LocalBoardTransport: LocalBoardTransport, RelayQueue: RelayQueue, localStorageKV: localStorageKV, mapKV: mapKV, RECORDS_KEY: RECORDS_KEY, KEY_KEY: KEY_KEY };
  global.RelayStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
