/* Gate C — 20/20 synthetic records persist encrypted through a restart,
   queue offline, relay on reconnect, and deduplicate correctly. */
const assert = require('node:assert');
const Core = require('../relay-core.js');
const Storage = require('../storage.js');

(async function () {
  const cats = ['RED', 'YELLOW', 'GREEN', 'BLACK'];
  const base = Date.parse('2026-10-31T15:00:00-05:00');
  const records = [];
  for (let i = 0; i < 20; i++) {
    const n = i + 1;
    const draft = {
      rawText: '', tag: 'T-' + String(n).padStart(2, '0'), category: cats[i % 4],
      careGiven: ['no_care_given'], medicationCandidate: null, unconfirmedItems: [],
      narrativeDraft: 'Synthetic casualty number ' + n + '.', locationLabel: 'Grandstand'
    };
    records.push(Core.buildRecord(draft, {}, {
      online: false, recordId: 'gate-c-' + String(n).padStart(2, '0'),
      createdAt: new Date(base + i * 60000).toISOString(),
      confirmedAt: new Date(base + i * 60000 + 30000).toISOString()
    }));
  }
  assert.ok(records.every(r => r.syncState === 'queued'), 'all 20 start queued (offline)');

  /* --- save encrypted --- */
  const kvMap = new Map();
  const store = await new Storage.RelayStore(Storage.mapKV(kvMap)).init();
  await store.saveAll(records);
  const rawStored = kvMap.get(Storage.RECORDS_KEY);
  assert.ok(rawStored && rawStored.length > 100, 'ciphertext stored');
  assert.ok(!rawStored.includes('Synthetic casualty'), 'no plaintext narrative in storage');
  assert.ok(!rawStored.includes('"category"'), 'no plaintext record JSON in storage');
  console.log('encryption-at-rest PASS — stored bytes contain no plaintext records');

  /* --- restart: brand-new store over a serialized copy of the same KV --- */
  const revived = new Map(JSON.parse(JSON.stringify(Array.from(kvMap.entries()))));
  const store2 = await new Storage.RelayStore(Storage.mapKV(revived)).init();
  const loaded = await store2.loadAll();
  assert.strictEqual(loaded.length, 20, '20/20 records survive restart');
  assert.deepStrictEqual(loaded.map(r => r.tag).sort(), records.map(r => r.tag).sort(), 'tags intact after restart');
  assert.strictEqual(loaded[2].narrative, 'Synthetic casualty number 3.', 'record content intact after decrypt');
  console.log('restart persistence PASS — 20/20 records decrypt intact');

  /* --- reconnect: flush the queue --- */
  const transport = new Storage.LocalBoardTransport();
  const queue = new Storage.RelayQueue(store2, transport);
  const results = await queue.flush();
  assert.strictEqual(results.length, 20, 'flush attempted all 20');
  assert.ok(results.every(r => r.outcome === 'accepted'), 'all 20 accepted');
  const after = await store2.loadAll();
  assert.ok(after.every(r => r.syncState === 'relayed'), 'all 20 marked relayed');
  assert.strictEqual(transport.board().length, 20, 'board holds 20');
  console.log('relay-on-reconnect PASS — 20/20 queued → relayed');

  /* --- dedupe: same record delivered again --- */
  assert.strictEqual(transport.deliver(after[0]), 'duplicate-id');
  assert.strictEqual(transport.board().length, 20, 'duplicate delivery changes nothing');
  const again = await queue.flush();
  assert.strictEqual(again.length, 0, 'second flush has nothing to do');
  console.log('dedupe (same record) PASS — idempotent relay');

  /* --- dedupe: tag re-entry as an update --- */
  const target = after[2];
  const update = Object.assign({}, target, { recordId: 'gate-c-03b', duplicateOf: target.recordId, narrative: 'Updated by the responder.' });
  assert.strictEqual(transport.deliver(update), 'tag-update');
  assert.strictEqual(transport.board().length, 20, 'update replaces, board still 20');
  const boardRec = transport.board().find(r => r.tag === target.tag);
  assert.strictEqual(boardRec.narrative, 'Updated by the responder.', 'board shows the update');
  console.log('dedupe (tag update) PASS — replace, never double-count');

  /* --- dedupe: unexplained tag collision is held, not merged --- */
  const rogue = Object.assign({}, after[4], { recordId: 'gate-c-rogue', duplicateOf: null });
  assert.strictEqual(transport.deliver(rogue), 'tag-conflict');
  assert.strictEqual(transport.board().length, 20, 'conflict does not join the board');
  assert.strictEqual(transport.conflicts.length, 1, 'conflict is visible for a human decision');
  console.log('dedupe (tag conflict) PASS — held for a human, never silent');

  const sorted = Core.sortBoard(transport.board());
  assert.strictEqual(sorted[0].category, 'RED', 'board sorts red-first');
  console.log('\nGATE C: PASS — 20/20 persist, queue, relay, dedupe');
})().catch(e => { console.error(e); process.exit(1); });
