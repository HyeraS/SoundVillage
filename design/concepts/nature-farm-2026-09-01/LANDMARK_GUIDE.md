# Brookside Bloom v2 — landmark guide

The approved reference contains a 47 px HUD above a 1448×1039 map image. The
map portion is normalized to the runtime's 48×36 logical grid. Boxes below are
measured from the visible silhouette, including roof/canopy overhang; collision
footprints remain smaller and are aligned to the character's feet.

| Landmark | Reference normalized box `(x,y,w,h)` | Target 48×36 box | Target footprint/walk lane | Expected tolerance |
| --- | --- | --- | --- | --- |
| Watermill | `.131,.060,.239,.213` | `6,2,12,8` | `9,7,8,3` | center ≤1 tile; size ≤15% |
| North cottage | `.587,.059,.180,.205` | `28,2,9,8` | `29,7,7,3` | center ≤1 tile; size ≤15% |
| Greenhouse | `.785,.089,.165,.173` | `38,3,8,6` | `38,7,8,2` | center ≤1 tile; size ≤15% |
| South cottage | `.050,.667,.109,.175` | `2,24,6,7` | `3,28,5,3` | center ≤1 tile; size ≤15% |
| Upper bridge | `.405,.236,.166,.123` | `19,9,9,4` | walk lane `19,10,9,2` | center ≤1 tile; size ≤15% |
| Lower bridge | `.462,.717,.175,.117` | `22,26,9,4` | walk lane `22,27,9,2` | center ≤1 tile; size ≤15% |
| Wheat field | `.055,.314,.152,.157` | `3,12,7,6` | perimeter fence, east/south opening | center ≤1 tile; size ≤15% |
| Vegetable field | `.165,.511,.182,.131` | `8,19,9,5` | perimeter fence, south opening | center ≤1 tile; size ≤15% |
| Corn field | `.220,.688,.159,.136` | `11,25,8,5` | perimeter fence, south opening | center ≤1 tile; size ≤15% |
| Orchard | `.604,.367,.198,.287` | `29,14,10,10` | six trunks, open lower gate | center ≤1 tile; size ≤15% |

Creek center guide `(row, column)`:

```text
(0,23) → (5,23) → (10,23) → (15,20) → (20,21) →
(25,24) → (30,28) → (35,35)
```

The visible shoreline may extend beyond the collision-water mask by rocks,
grass fringe and shallow-water pixels, but the discrepancy must remain within
half a tile. The two bridge decks are the only dry crossings.

## Known planned differences

- Reference HUD, player and sound orbs remain dynamic product layers and are not
  baked into any environment asset.
- Door aprons and fence openings may be widened by up to half a tile where the
  18×10 px player foot box needs stable diagonal passage.
- Dense reference flowers are omitted within reserved sound/item clearance and
  along bridge landings; the surrounding cluster rhythm must remain recognizable.

