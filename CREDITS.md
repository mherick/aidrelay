# Credits — how AidRelay was made

AidRelay is a solo build by Armando Fierro (Team Naian), made with
Meta AI models in the product and Meta AI agents in the production.

## In the product (runtime)

- **Muse Spark 1.3** (Meta Model API) — structures the responder's
  dictation into the fixed record schema.
- **Muse Spark 1.2** (Meta Model API) — transcribes recorded
  dictation. (Muse Voice Transcribe 1.0 was evaluated during the
  build; it was not available on this account, so transcription
  ships on Spark 1.2.)
- **Muse Spark Open** (Meta open weights, via Baseten) — optional
  alternate structuring provider: the same prompt and the same
  validation gate, on the open-weights model (live smoke results
  in `tests/smoke-baseten-results.json`).

## In development

- **Muse Spark** (Meta's personal agent) — design, implementation,
  and test authoring alongside the builder throughout the event,
  including the RELAYMASTER design review and the gate test suites.
- **Meta Model API** — live smoke testing of the structuring path
  (results recorded in `tests/smoke-results.json`).

## The demo video

- **Director** — a Muse Spark agent: storyboard and the full
  production package (script, shot list, cards).
- **Editors** — Muse Spark agents: rough cuts v1–v9 (assembly,
  music mix, caption burn-in).
- **Judge** — a Muse Spark agent: an independent rubric evaluation
  of the video, this repo, and the submission draft (Oct 31, 2026).
- **Narration** — Piper text-to-speech (open source, rhasspy),
  voice `en_US-hfc_male-medium`. Not a Meta model.
- **Music** — "Volatile Reaction" by Kevin MacLeod
  (incompetech.com). Licensed under Creative Commons:
  By Attribution 4.0 License
  (http://creativecommons.org/licenses/by/4.0/).
- **B-roll** — Mixkit stock footage, free license.
- **Footage** — the builder's own iPhone screen recordings of the
  shipped app, shot Oct 31, 2026.

Everything above was produced during the hackathon window,
Oct 26 – Nov 4, 2026.
