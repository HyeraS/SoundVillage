# 2C-C Music Marker Production State Mapping

## Runtime authority

Music markers expose only state already authoritative in the existing application contract. The renderer does not infer database writes, audio failures, annotation rows, or save progress. The shared visual is a neutral ring/glyph; no instrument, note, tape, cassette, source label, or answer category is shown.

| State | Authoritative source | Entry condition | Exit condition | Reconnect restoration | Production status / fallback |
|---|---|---|---|---|---|
| Unavailable (locked) | `blockNum` prop + `sound.block` | `sound.block > blockNum` | block becomes unlocked | Yes, from existing progression state | Connected. Hidden rather than rendering 60–70 strong locked markers. No interaction. |
| Active | `blockNum`, `collectedIds` | `block <= blockNum` and ID not collected | nearby, interacting, or collected | Yes | Connected. Neutral cyan ring/wave glyph. |
| Nearby | local 20×14 player / 24×24 sound overlap | active marker overlaps interaction rect | player leaves rect, annotation opens, or marker completes | No; proximity is recomputed | Connected. Gold ring, neutral prompt `Enter ↵ 이 소리 전사하기`. |
| Interacting | local selected sound ID + existing `isAnnotating` prop | `onCollectSound(item.sound)` opens annotation for that ID | annotation closes | No; annotation route is current-session UI | Connected. Lavender pause glyph while panel is open. New discovery remains blocked. |
| Completed | `collectedIds` prop | sound ID exists in `collectedIds` | existing application state removes ID | Yes, from existing participant progress | Connected. Low-alpha gray ring/check. |
| Submitting | No authoritative Music renderer prop | — | — | — | Not connected. Active/Interacting remains the safe visual fallback. Follow-up UI-state plumbing required. |
| Save error | No authoritative Music renderer prop | — | — | — | Not connected. No failure is inferred. Follow-up UI-state plumbing required. |
| Technical audio error | No authoritative Music renderer prop | — | — | — | Not connected. No failure is inferred. Follow-up UI-state plumbing required. |
| Locked (separate visible variant) | Same authority as Unavailable | — | — | Yes | Folded into hidden Unavailable in participant runtime to preserve hierarchy. The B4 visible locked style remains a QA vocabulary, not a requirement to display every future marker. |

## Transition summary

`Unavailable → Active → Nearby → Interacting → Completed` is the only production-connected path in 2C-C. `Submitting`, `Save error`, and `Technical audio error` remain documented but deliberately unbound until the application owns and passes those states.

`collectedIds`, `blockNum`, and `isAnnotating` are read through refs by the animation loop, so marker states update without remounting the Music map. Sound placement does not depend on any of those visual states.
