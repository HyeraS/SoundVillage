# User Event instrumentation inventory

This inventory describes semantic participant logging added in stage 4. No event is accepted before anonymous authentication and participant claim. `target_id` values are stable product identifiers, never DOM positions or CSS classes. Expression input events contain only length/empty state.

| Screen/component | User action | event_name | Trigger / dedupe | Main payload | Sensitive data | Result link |
|---|---|---|---|---|---|---|
| `app/page.js` | authenticated load/reload | `session_started`, `session_resumed` | once per client instance | study session ID | no credential/token | no |
| `app/page.js` | screen transition | `screen_exited`, `screen_viewed` | state transition; initial view deduped | screen, zone | none | no |
| `app/page.js` | automatic check-in | `attendance_check_*` | one operation attempt/result | operation key, attendance ID, reward transaction | none | 003 attendance operation |
| `StartPanel` | participant claim | none before claim | logging deliberately starts only after successful claim | — | participant secret/claim input excluded | — |
| `WorldMap` | approach a zone portal | `collectible_prompt_shown` | proximity edge, not animation frames | zone, locked | none | no |
| world/zone/library/interior maps | begin a meaningful direction input | `map_control_activated` | keydown transition excluding repeat, or D-pad press transition; never per frame | stable direction control, screen, zone, keyboard/D-pad source | coordinates excluded | no |
| `WorldMap` / `app/page.js` | try/enter locked or open zone | `zone_entry_attempted`, `zone_entry_blocked`, `zone_entry_succeeded` | confirm action and completed navigation | stable `zone-*`, blocked reason | none | no |
| `WorldMap` | open/close attendance or quest panel | `attendance_panel_opened`, `attendance_panel_closed`, `quest_panel_opened`, `quest_panel_closed` | panel state edge; one close per open instance | stable panel ID, close reason, interaction method | none | no |
| zone maps / `app/page.js` | leave zone | `zone_exited` | exit callback | zone, `zone-exit` | none | no |
| zone maps / `app/page.js` | activate sound collectible | `collectible_activated` | completed activation callback | sound ID, zone | none | no |
| `AnnotationPanel` | modal open/close | `annotation_modal_opened`, `annotation_modal_closed` | modal UUID; one close guard | sound, modal instance, close reason | none | no |
| `AnnotationPanel` | play/pause/finish/fail | `audio_play_attempted`, `audio_play_started`, `audio_paused`, `audio_completed`, `audio_failed` | player state transitions | sound ID, public error code | none | no |
| `AnnotationPanel` | type/clear expression | `expression_input_started`, `expression_input_changed`, `expression_input_cleared` | input change | before/after length and empty only | raw input excluded | no |
| `AnnotationPanel` | change confidence | `confidence_changed`, `confidence_deselected` | selector activation | before/after confidence | none | no |
| `AnnotationPanel` | submit/skip | `annotation_submit_*`, `annotation_skip_*` | immediately before RPC and actual result | operation key, annotation/transaction IDs, retryable code | raw expression excluded | 003 annotation operation |
| `SoundMuseum` | enter/exit | `museum_entered`, `museum_exited` | component sound instance / exit callback | sound, zone, reason | none | no |
| `SoundMuseum` | fetch candidates | `museum_candidate_load_*` | each request/reload | count, sound, public error code | no participant ID | no |
| `SoundMuseum` | display candidates | `museum_expression_impression` | each rendered response, deduped per reload | anonymized annotation ID and order | other participant excluded | annotation ID only |
| `SoundMuseum` | select/unselect/change | `museum_expression_selected`, `museum_expression_deselected`, `museum_expression_changed` | candidate activation | anonymized annotation ID and index | expression text excluded | annotation ID only |
| `SoundMuseum` | museum audio | `museum_audio_play_attempted`, `museum_audio_play_started`, `audio_paused`, `audio_resumed`, `audio_completed`, `museum_audio_failed` | player transitions | sound ID | none | no |
| `SoundMuseum` | vote | `museum_vote_submit_*` | before RPC and actual result | operation key, vote/transaction IDs | none | 003 museum vote operation |
| museum outfit shop | open/unmount | `shop_opened`, `shop_closed` | component lifecycle | stable shop ID | none | no |
| `LibraryRoom` | open/close information card | `library_card_opened`, `library_card_closed` | card UUID; one close guard | stable card kind, close reason, interaction method | none | no |
| museum outfit shop | buy/equip | `purchase_*`, `outfit_equip_*` | before operation and actual result | item, displayed/confirmed price, balance, operation key | none | 003 purchase/equip operation |
| `InteriorDecorRoom` | enter/exit | `interior_entered`, `interior_exited` | app navigation | stable house ID | none | no |
| `InteriorDecorRoom` | select/deselect/add/move/flip/remove/undo | `interior_item_*`, `interior_change_undone` | completed semantic edit; drag/move logs final cell only | item ID, final grid cell, flip state | none | no |
| `InteriorDecorRoom` | save room | `room_save_*` | before retry-safe RPC and actual result | operation key, room result ID | room JSON excluded | 004 `room_save` operation |
| `InteriorDecorRoom` | copy invitation link | `invite_link_copy_succeeded`, `invite_link_copy_failed` | actual Clipboard API result; synchronous in-flight guard | stable copy button ID, public error code | URL/share token excluded | no |
| `InteriorDecorRoom` | buy item/set | `purchase_*` | before operation and actual result | item/set, price, balance, transaction, operation key | none | 003 purchase operation |
| shared room entry | open shared room | `friend_room_open_*` | authenticated request/result | session-scoped `shared-room` target | full share token excluded | no |
| `WorldMap` duo | connect/disconnect/reconnect | `duo_connected`, `duo_disconnected`, `duo_reconnected` | actual partner-presence edge; reconnect only after a prior presence observed in the same mounted map | generic `duo-peer` | share token/partner ID excluded | no |
| browser lifecycle | offline/online/hidden/pagehide | `network_offline`, `network_online` and flush | browser lifecycle edge | offline state | none | no |

## Reviewed surfaces and deliberate granularity

The inventory review covered `app/page.js`, start/auth, WorldMap, the generic and specialized zone maps, annotation, museum/library, outfit/interior shops, attendance/quest panels, interior room editing, shared-room entry, and duo presence. Movement coordinates and pointer-move frames are not logged. The six zone implementations converge on the same `onCollectSound` and `onExit` callbacks, so activation and exit are instrumented centrally without changing their game loops.

Stage 7 now captures generic-zone collectible approach/prompt edges and quest-row impressions. A quest is logged once per visible row in each opened panel instance; a closed-and-reopened panel is a new impression opportunity. A collectible is logged once when its prompt target becomes active, never per animation frame, and can be logged again only after the target clears and is re-entered. Whole-experiment completion is represented by the DB-linked `session_completed` event after the final annotation transaction. Reconnect classification across a `WorldMap` remount or browser session remains deliberately unresolved: the client distinguishes reconnect only after the same mounted map observed presence, absence, and presence again.
