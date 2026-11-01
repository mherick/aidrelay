# AidRelay

A civilian casualty relay for disaster, mass-casualty, wildland fire, and rural EMS scenes. A responder dictates the care already given for each casualty; the app structures it, the responder confirms it, and the record relays to a dispatch board sorted red-first. Offline-first, encrypted on the device, no account, no backend.

**This app gives no medical advice, diagnosis, or treatment recommendations.** It records care that trained responders already gave and relays it for dispatch. Its users are responders, dispatch coordinators, and the receiving facility. Triage categories and care entries are always stated by the responder and confirmed before they become a record — the app never assigns them.

**Built during the event:** all code in this repository was written during the Meta AI Developer Hackathon, October 26 – November 4, 2026. Indie track, Team Naian (solo build — Armando Fierro).

Demo video: https://youtu.be/LUchtA-aDk8

## For judges

No hosted version is provided or required, and no API keys ship anywhere in this repo or the app — you bring your own, or none.

**Replay path (no keys).** Open `index.html` and run the six built-in demo dictations in order (capture screen → demo dictations). Confirm each record — Case 1 asks for a medication read-back (confirm the morphine); Case 6's second-hand insulin mention must appear nowhere in its record. The final board is the board in the video: R-07, R-09, Y-12, Y-15, G-03, K-02 — counts RED 2 · YELLOW 2 · GREEN 1 · BLACK 1. The builder's recorded live runs ship as provenance: `tests/smoke-results.json` (hosted Muse Spark 1.3, Oct 30, 2026) and `tests/smoke-baseten-results.json` (Muse Spark Open via Baseten, Oct 31, 2026) hold the raw model outputs, and they can be re-verified offline any time with `node tests/smoke-validate.js` and `node tests/smoke-baseten-validate.js`.

**Live path (your own keys).** Run `python3 server.py`, open the app, switch to **Meta AI (live)**, and paste your own Meta Model API key. To run structuring on the open-weights model instead, also paste a Baseten API key and select the Baseten provider. Keys are kept in that browser's local storage only; the local server relays calls without storing or logging them. To re-run the recorded live smokes from a terminal, set `MODEL_API_KEY` / `BASETEN_API_KEY` (see `.env.example`) and run `python3 tests/meta_smoke.py` / `python3 tests/baseten_smoke.py` — a re-run overwrites the recorded outputs, so back up the shipped JSONs first if you want the comparison.

## How it works

- **Capture.** Dictate (microphone or an uploaded recording), use the built-in demo dictations, or type the entry. Care is captured against a fixed list of 17 completed-action items (`docs/schema.md`) — there is no free-text care entry, and instruction sentences ("he needs…", "you should…") can never become record facts.
- **Structure.** Two modes. *On-device:* a deterministic local parser. *Meta AI (live):* Muse Spark 1.3 structures the dictation and Muse Spark 1.2 transcribes recordings (converted to 16 kHz WAV in the browser), using **your own** Meta Model API key, entered in the app and kept in that browser only. Live structuring can optionally run on Meta's open-weights model instead — see **Open weights** below.
- **The AI gate.** Every Spark draft passes `validateAiDraft` before it is shown. Each fact must trace to the transcript, checked against the local parse: invented care items, assigned categories, added fields (e.g. a diagnosis), invented locations, advice language, and medications not stated as given are rejected — the *whole* draft is rejected, the reason is shown, and the on-device read is used instead. In a live run on Oct 30, 2026, Spark's output matched the expected record on 5 of 6 scripted cases; on the sixth it invented a care item and the gate rejected it. Recorded outputs are in `tests/smoke-results.json`.
- **Medication rule.** A medication enters a record only after a verbatim read-back and an explicit responder confirmation. Second-hand or hedged mentions ("some insulin earlier, I think") are structurally barred from the record.
- **Confirm, then relay.** Nothing reaches the board unconfirmed. Records are encrypted at rest (AES-GCM, WebCrypto), queued offline, relayed on reconnect, and deduplicated (a re-delivery is ignored; an unexplained tag collision is held for a human, never silently merged). The dispatch board sorts red-first with counts by category; each casualty has a one-tap handoff — a plain-language restatement of confirmed facts only, machine-checked against a banned-language list so nothing the app says reads as advice.

All demo casualties are fictional (a storm-damaged county fairground). The six scripted cases, with expected records and board order, are in `docs/demo-scripts.md`.

## Open weights

Live mode offers a second structuring provider: **Muse Spark Open** (Meta's open-weights model, hackathon build `meta-models/muse-spark-open-1026`) served by Baseten, using **your own** Baseten API key, also entered in the app and kept in that browser only. It receives the identical structuring prompt and its output passes the identical `validateAiDraft` gate — same app, same gate, open-weights model. The Baseten provider structures only: transcription still runs on the hosted Meta API (Muse Spark 1.2), because the Baseten hackathon key serves that one chat model.

In a live run on Oct 31, 2026, Spark Open's drafts were accepted on all 6 scripted cases with fields matching the expected records — including the case where the hosted Spark 1.3 draft had been rejected for inventing a care item. The same run showed the opposite failure direction on an adversarial case: a medication the responder stated as given (ketamine, by another crew) was left in the narrative and produced no medication candidate, so no read-back would have been offered; the hosted model structured that one as a candidate. Nothing was invented in either direction — the gate's standard is that a draft may add nothing, and both models met it. Recorded outputs are in `tests/smoke-baseten-results.json`.

## Run it

### On-device mode (no server, no key)

Open `index.html` in a browser, phone or desktop. Everything works — capture, confirm, board, handoff, offline queue — with no network at all.

### Live mode on the same machine

```
python3 server.py        # serves the app at http://127.0.0.1:8772
```

Open the printed address, switch the capture screen to **Meta AI (live)**, and paste your own Meta Model API key. When served from localhost, the page routes Meta calls through the local server (your key travels page → your machine → Meta; it is never stored or logged).

### On a phone, with the live microphone (HTTPS setup)

Browsers only allow microphone access on secure (HTTPS) pages, so the phone path needs a local certificate. This is a one-time, ~5-minute setup on a trusted home network. You generate your own certificate authority; **never commit the generated files — they are covered by `.gitignore`, and a CA private key must never leave your machine.**

1. Generate a local CA and a server certificate. Replace `192.168.1.50` with your computer's Wi-Fi (LAN) address:

   ```
   openssl genrsa -out ca.key 2048
   openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt -subj "/CN=AidRelay Local CA"

   printf '[req]\ndistinguished_name = dn\nreq_extensions = ext\n[dn]\n[ext]\nsubjectAltName = DNS:localhost,IP:127.0.0.1,IP:192.168.1.50\n' > server.cnf
   openssl genrsa -out key.pem 2048
   openssl req -new -key key.pem -out server.csr -subj "/CN=localhost" -config server.cnf
   openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cert.pem -days 825 -sha256 -extfile server.cnf -extensions ext
   ```

2. Put `cert.pem`, `key.pem`, and `ca.crt` next to `server.py` and start it:

   ```
   python3 server.py
   ```

   With the certificates present it also serves a secure address, `https://<your-LAN-address>:8773`. (Without them, only the http door on 8772 runs.)

3. On the phone (same Wi-Fi, in **Safari** on iOS): open the http address the server prints and tap the CA download, then install it: **Settings → Profile Downloaded → Install**. Then give it full trust: **Settings → General → About → Certificate Trust Settings** → enable your CA. (Android: Settings → Security → Install certificates, then trust it for Wi-Fi/browser use as your device requires.)

4. Open the **https** address in the phone browser, then **Add to Home Screen** — the app installs as a standalone phone app and runs full-screen, online or off. Paste your Meta Model API key once on the phone (keys are stored per device, in that browser only).

5. Dictate Case 1 from `docs/demo-scripts.md` to see the full path: transcript → structured draft → medication read-back → confirm → board.

No microphone available? Use **"Or use a recording"** on the capture screen (a Voice Memos file works), or the typed entry / demo dictations — neither needs the mic.

Only run the server on a trusted network while testing; Ctrl+C stops it.

## Verify

```
node tests/gate-b.test.js   # Gate B — the six scripted dictations produce the expected records
node tests/gate-c.test.js   # Gate C — offline queue: persistence, relay on reconnect, dedupe
node tests/gate-d.test.js   # Gate D — boundary set: 20 adversarial inputs, 6 handoffs, 0 fact violations
node tests/gate-e.test.js   # Gate E — the AI gate: fabricated AI drafts accepted or rejected wholesale
node tests/smoke-validate.js  # re-verifies the recorded live-run outputs in tests/smoke-results.json
node tests/smoke-baseten-validate.js  # re-verifies the recorded Spark Open outputs in tests/smoke-baseten-results.json
```

The recorded live runs (Oct 30, 2026 hosted; Oct 31, 2026 Baseten) used the builder's own keys; their raw outputs ship in `tests/smoke-results.json` and `tests/smoke-baseten-results.json` so the verdicts can be re-checked offline with the validators above. Both runs are also re-runnable with your own keys — see `.env.example` and **For judges** above.

## Design law and limits

Documentation and dispatch only. Civilian-only. The app records what trained responders state and confirm; it does not advise, diagnose, triage, or recommend. This demo build relays locally on the device/browser — there is no server backend — and its encryption key handling is demo-grade (the device key is generated once and held in the browser's own storage; a production build would use the platform keystore). AidRelay is not a medical device.
