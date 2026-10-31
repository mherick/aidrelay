# Civilian Casualty Relay — Record Schema (LOCKED, Phase 0)

Locked Oct 30, 2026, per RELAYMASTER §6. Changes after this lock require a RELAYMASTER Decision entry (Build/Defer/Refuse + boundary check) — no silent schema drift during the build.

## 1. Two objects: Draft and Record

- **Draft** — everything captured before confirmation: raw transcript, the structured proposal, and `unconfirmedItems`. Drafts live only on the device and are never shown on the dispatch board or in a handoff.
- **Record** — created only when the responder confirms. Only Records relay. Only confirmed facts exist in a Record.

## 2. Record fields

| Field | Owner | Type / values | Rule |
|---|---|---|---|
| `recordId` | system | UUID | Assigned at draft creation; survives confirmation and relay unchanged (dedupe key, part 1) |
| `incidentId` | system | string | One local incident per device session in the demo slice |
| `tag` | responder | string, e.g. `R-07` | Code name / tag number only. Never a real name. Dedupe key, part 2 |
| `category` | responder | `GREEN` \| `YELLOW` \| `RED` \| `BLACK` | Stated by the responder. Labels: GREEN = Minor, YELLOW = Delayed, RED = Immediate, BLACK = Expectant. The app never assigns or changes it |
| `careGiven` | responder | array of fixed-list IDs (§3) | Completed actions only. Empty array is valid |
| `medications` | responder | array of `{name, dose, route, confirmedAt}` | Enters a Record **only** after verbatim read-back + explicit confirmation (§4). Otherwise the mention lives in `draft.unconfirmedItems` and nowhere else |
| `narrative` | responder | string | The responder’s own words, stored as stated. Never rewritten into conclusions |
| `location` | device, responder-correctable | `{lat, lon, label, source: gps\|manual, approximate: bool}` or `null` | `null` displays as “Location not set.” Manual override always available |
| `createdAt` / `confirmedAt` | device | timestamps | Elapsed time on the board runs from `confirmedAt` |
| `confirmationState` | system | `draft` \| `confirmed` | Board and handoff read `confirmed` only |
| `syncState` | system | `on_device` \| `queued` \| `relayed` \| `acknowledged` | Displayed in plain language; `queued` shows “No signal. Saved on this phone. It will send later.” |
| `duplicateOf` | system | recordId or `null` | Set when the same `tag` is entered twice and the responder chooses “update existing” |

**Excluded fields — must not exist in code, UI, or AI output:** diagnosis, provider impression, suspected condition, recommended treatment, next-step suggestion, AI-assigned acuity/category, real patient name, free-text medication entry without the §4 path.

## 3. Fixed care list (FROZEN)

Past-tense, observable, completed actions. UI shows the label; storage uses the ID. No item may be reworded as an instruction.

| ID | Label |
|---|---|
| `tourniquet_applied` | Tourniquet applied |
| `direct_pressure` | Direct pressure applied |
| `wound_packed` | Wound packed |
| `hemostatic_dressing` | Hemostatic dressing applied |
| `airway_positioned` | Airway positioned |
| `oxygen_applied` | Oxygen applied |
| `iv_started` | IV started |
| `io_started` | IO started |
| `medication_given` | Medication given — responder-confirmed details |
| `fluids_started` | Fluids started |
| `splint_applied` | Splint applied |
| `chest_seal_applied` | Chest seal applied |
| `cpr_in_progress` | CPR in progress |
| `aed_applied` | AED applied |
| `kept_warm` | Kept warm / blanket applied |
| `moved_to_collection` | Moved to casualty collection point |
| `no_care_given` | No care given yet |

## 4. Medication rule (no exceptions)

1. A medication mention in dictation creates a `draft.unconfirmedItem` — nothing more.
2. The confirmation screen reads it back **verbatim** (name, dose, route as stated).
3. The responder explicitly confirms or deletes it. Confirm → `medications` entry + `medication_given` in `careGiven`. Delete / ignore → it is gone; it never appears on the board, in the handoff, or in any count.
4. If the dictation is ambiguous (“some insulin, I think”), the item is marked ambiguous, cannot be confirmed from that dictation, and the responder must re-state it clearly or drop it.

## 5. JSON shape (Record)

```json
{
  "recordId": "uuid",
  "incidentId": "DEMO-01",
  "tag": "R-07",
  "category": "RED",
  "careGiven": ["tourniquet_applied", "wound_packed", "iv_started", "medication_given"],
  "medications": [{"name": "morphine", "dose": "4 mg", "route": "IV", "confirmedAt": "2026-10-31T14:32:00-05:00"}],
  "narrative": "Adult male, leg injury from the collapsed barn roof.",
  "location": {"lat": 41.5500, "lon": -90.5800, "label": "Fairground north gate", "source": "gps", "approximate": false},
  "createdAt": "2026-10-31T14:29:00-05:00",
  "confirmedAt": "2026-10-31T14:30:00-05:00",
  "confirmationState": "confirmed",
  "syncState": "relayed",
  "duplicateOf": null
}
```

All coordinates, names, and events in this schema’s examples are synthetic.
