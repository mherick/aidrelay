# Civilian Casualty Relay — Synthetic Demo Casualties (Phase 0)

Written Oct 30, 2026. **All six casualties are fictional.** Setting for all: a storm-damaged county fairground — civilian disaster response, volunteer and rural EMS crews. These scripts are the single source of truth for development (Phase 1 Gate B), the offline test (Gate C), and the demo video.

Incident: `DEMO-01`. Times are scene-relative (T+ minutes from first record confirmed).

---

## Case 1 — R-07 · RED · the medication read-back path
**Proves:** full capture, IV + medication with verbatim read-back and explicit confirmation.

**Dictation (responder’s words):**
> “Tag R-07. Red, immediate. Adult male, leg injury from the collapsed barn roof, fairground north gate. Tourniquet applied to the left leg, wound packed, IV started. Morphine, 4 milligrams, IV — given at T plus four. Confirm that back to me.”

**Expected Record:**
- tag `R-07`, category `RED`
- careGiven: `tourniquet_applied`, `wound_packed`, `iv_started`, `medication_given`
- medications: `[{name: "morphine", dose: "4 mg", route: "IV", confirmed}]`
- narrative: “Adult male, leg injury from the collapsed barn roof.”
- location: fairground north gate (GPS)
- syncState: `relayed` · confirmed at T+0

## Case 2 — Y-12 · YELLOW · the offline path
**Proves:** airplane-mode entry, plain-language queue state, relay on reconnect.

**Dictation:**
> “Tag Y-12. Yellow, delayed. Adult female, arm injury from flying debris near the grandstand. Splint applied, oxygen applied. We have no signal out here.”

**Expected Record:**
- tag `Y-12`, category `YELLOW`
- careGiven: `splint_applied`, `oxygen_applied`
- narrative: “Adult female, arm injury from flying debris near the grandstand.”
- location: grandstand (manual label, GPS approximate)
- syncState: `queued` at entry → `relayed` when connectivity returns · confirmed at T+3

## Case 3 — G-03 · GREEN · the minimal record
**Proves:** walking-wounded capture in seconds; `no_care_given`; no forced fields.

**Dictation:**
> “Tag G-03. Green, minor. Teenager, small cut on the hand, walking around on his own. No care given yet. He’s at the first aid tent.”

**Expected Record:**
- tag `G-03`, category `GREEN`
- careGiven: `no_care_given`
- narrative: “Teenager, small cut on the hand, walking on his own.”
- location: first aid tent (manual)
- syncState: `relayed` · confirmed at T+5

## Case 4 — R-09 · RED · the second red (board ordering)
**Proves:** two REDs sort by confirmed time; CPR/AED fixed-list capture.

**Dictation:**
> “Tag R-09. Red, immediate. Adult female found unresponsive by the show ring. CPR in progress, AED applied. Moved to the casualty collection point.”

**Expected Record:**
- tag `R-09`, category `RED`
- careGiven: `cpr_in_progress`, `aed_applied`, `moved_to_collection`
- narrative: “Adult female found unresponsive by the show ring.”
- location: casualty collection point
- syncState: `relayed` · confirmed at T+7

## Case 5 — K-02 · BLACK · the expectant record
**Proves:** BLACK is recorded with the same dignity and brevity; sorts last; no care claims invented.

**Dictation:**
> “Tag K-02. Black, expectant. Adult male found under the grandstand debris. Airway positioned, no breathing after positioning. Kept with the expectant area by the grandstand.”

**Expected Record:**
- tag `K-02`, category `BLACK`
- careGiven: `airway_positioned`
- narrative: “Adult male found under the grandstand debris. No breathing after airway positioning.”
- location: grandstand, expectant area
- syncState: `relayed` · confirmed at T+9

## Case 6 — Y-15 · YELLOW · the unconfirmed-medication trap
**Proves:** the safety feature. An ambiguous medication mention must **not** become a record fact.

**Dictation:**
> “Tag Y-15. Yellow, delayed. Adult male, dizzy and sweating by the food stands. IV started, fluids started. Somebody said he got some insulin earlier, I think — I didn’t see it.”

**Expected handling:**
- Draft contains `unconfirmedItem`: “insulin — mentioned second-hand, ambiguous.”
- Confirmation screen shows it flagged; the responder does **not** confirm it (he didn’t witness it).
- **Final Record:** tag `Y-15`, category `YELLOW`, careGiven: `iv_started`, `fluids_started`; medications: `[]` — the insulin mention appears **nowhere** in the Record, the board, or the handoff.
- narrative: “Adult male, dizzy and sweating by the food stands.”
- location: food stands · syncState: `relayed` · confirmed at T+11

---

## Expected dispatch board order (all six confirmed)

Sort rule: category rank (RED → YELLOW → GREEN → BLACK), then `confirmedAt` ascending.

| # | Tag | Category | Confirmed | Note |
|---|---|---|---|---|
| 1 | R-07 | RED | T+0 | Medication confirmed on record |
| 2 | R-09 | RED | T+7 | CPR in progress |
| 3 | Y-12 | YELLOW | T+3 | Entered offline; relayed on reconnect |
| 4 | Y-15 | YELLOW | T+11 | No medications on record (by design) |
| 5 | G-03 | GREEN | T+5 | No care given yet |
| 6 | K-02 | BLACK | T+9 | Expectant |

Board counts: RED 2 · YELLOW 2 · GREEN 1 · BLACK 1.

## Demo-video mapping
- Beat 1 (problem): fairground aftermath, paper tag in the rain.
- Beat 2: Case 1 dictated → confirmation read-back shown.
- Beat 3: Case 2 in airplane mode → “No signal. Saved on this phone. It will send later.” → reconnect → relayed.
- Beat 4: board with all six, red-first; Case 6 called out — “what wasn’t confirmed never became a fact.”
- Beat 5: handoff summary for R-07 (confirmed facts only).
- Close: mandated statement on screen.

---

## Gate A — boundary review (Oct 30, 2026)

Applied to `casualty-relay-schema.md` + this file, per RELAYMASTER §8 (Stated? Confirmed? Fixed-list or narrative? Advice hidden anywhere?).

- **Stated by responder:** every clinical item in all six expected Records traces to words in its dictation script. No field is filled by inference. ✅
- **Confirmed before record:** all six cases pass through the confirmation state; Case 1’s medication uses the §4 verbatim read-back path; Case 6’s ambiguous mention is structurally barred from the Record. ✅
- **Fixed-list or narrative only:** care items map 1:1 to frozen list IDs; everything else lives in `narrative` as the responder’s own words. ✅
- **Advice language scan:** machine scan of both files for advice/diagnosis/treatment/military phrasing returned exactly one hit — the schema’s own *excluded-fields prohibition* listing what must not exist. Dictations contain observations and completed actions only; no “should give,” no recommendations, no diagnosis terms, no military content. ✅
- **Civilian framing:** setting, roles, and language are civilian throughout (county fairground, volunteer/rural EMS). ✅

**Verdict: GATE A — PASS.** Schema and scripts are locked for Phase 1. One standing caution for the build: Case 5’s narrative (“No breathing after airway positioning”) is a responder observation and stays in `narrative` only — it must never be converted into a status field or summary conclusion.
