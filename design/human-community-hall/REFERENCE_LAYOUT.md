# Human Community Hall reference layout

## Coordinate system

- Absolute visual reference: `public/design-previews/human-village-concepts/01-community-hall-plaza.png`
- Reference raster: **1448×1086 RGB**, exactly 4:3.
- Logical world: **48×36 tiles**. One logical reference tile is `1448 / 48 = 1086 / 36 = 30.1667px`.
- Runtime master: **1536×1152**, or 32px per tile. Reference-to-runtime scale is `32 / 30.1667 = 1.06077348`.
- Bounds below were measured on the original-size reference. They are layout anchors, not collision rectangles; collision is intentionally fitted to the visible ground footprint rather than roofs or foliage.

## Major composition anchors

| Element | Reference bbox / point (px) | Normalized reference | 48×36 logical grid | Current v1 placement / main difference |
| --- | --- | --- | --- | --- |
| Dense outer forest and boundary | top `y=0..70`; left `x=0..112`; right `x=1344..1448`; bottom `y=972..1086`, except gate | core opening about `x=.077..929`, `y=.064..895` | playable visual core about `x=3.7..44.6`, `y=2.3..32.2` | v1 has only thin edge strips and large exposed grass fields |
| South gate / entrance | `x=636..811`, `y=922..1044`; opening center `(724,981)` | center `(0.500,0.903)` | bbox `x=21.1..26.9`, `y=30.6..34.6`; center `(24.0,32.5)` | same center, but v1 lacks gateposts, wall, forest funnel and dirt continuation |
| Central vertical approach | approximately `x=635..813`, `y=655..1000` | width `.123W` | `x=21.1..27.0`, `y=21.7..33.1` | v1 is a wide, perfectly straight rectangular stone strip with coarse tile seams |
| Community hall | `x=548..907`, `y=53..369`; center `(728,211)` | center `(0.503,0.194)` | bbox `x=18.2..30.1`, `y=1.8..12.2`; center `(24.1,7.0)` | v1 bbox is about `17..31, 0..10`; hall is too high/isolated and its precinct is too empty |
| Hall steps and forecourt | `x=520..962`, `y=302..491` | center `(0.512,0.365)` | bbox `x=17.2..31.9`, `y=10.0..16.3` | v1 substitutes a broad flat plaza and oversized cream stair bars |
| Central shade tree and circular bed | `x=632..817`, `y=502..666`; center `(724,584)` | center `(0.500,0.538)` | bbox `x=21.0..27.1`, `y=16.6..22.1`; center `(24.0,19.4)` | v1 tree is near the right size but sits in an oversized, empty orthogonal plaza |
| Northwest bakery | `x=15..320`, `y=119..399`; center `(168,259)` | center `(0.116,0.238)` | bbox `x=.5..10.6`, `y=3.9..13.2` | v1 bakery begins at tile 1 but is separated from the hall by broad lawn instead of walls/garden lanes |
| Northwest garden / laundry yard | `x=145..486`, `y=36..282` | center `(0.218,0.146)` | bbox `x=4.8..16.1`, `y=1.2..9.3` | absent as a connected dense yard; only a small bottom clothesline exists |
| Northeast residence and bicycles | `x=1092..1314`, `y=39..304`; center `(1203,172)` | center `(0.831,0.158)` | bbox `x=36.2..43.6`, `y=1.3..10.1` | v1 uses a flower shop in the northeast and loses the bicycle courtyard |
| East clinic | `x=1088..1342`, `y=270..518`; center `(1215,394)` | center `(0.839,0.363)` | bbox `x=36.1..44.5`, `y=8.9..17.2` | broadly similar landmark but too detached and missing enclosing wall/garden detail |
| West residence | `x=130..414`, `y=421..644`; center `(272,533)` | center `(0.188,0.491)` | bbox `x=4.3..13.7`, `y=14.0..21.3` | broadly similar building slot, but v1 removes its dense hedge, wall and bench pocket |
| Southwest homes / shop row | `x=13..484`, `y=615..949` | center `(0.172,0.720)` | bbox `x=.4..16.0`, `y=20.4..31.5` | v1 collapses the row into one isolated cafe building |
| Southwest cafe terrace | `x=274..621`, `y=691..949`; center `(448,820)` | center `(0.309,0.755)` | bbox `x=9.1..20.6`, `y=22.9..31.5` | v1 has one tiny table and canopy instead of a packed shopfront and three seating groups |
| Southeast laundry | `x=1043..1340`, `y=523..705`; center `(1192,614)` | center `(0.823,0.565)` | bbox `x=34.6..44.4`, `y=17.3..23.4` | v1 placement is lower and leaves a large empty lawn around it |
| Southeast notice board / community garden | `x=849..1340`, `y=691..950` | center `(0.756,0.756)` | bbox `x=28.1..44.4`, `y=22.9..31.5` | v1 has the same nouns but a sparse, mechanical row rather than the reference enclosure |

## Paths, borders, and density

| Feature | Reference measurement | Logical reading | v1 mismatch |
| --- | --- | --- | --- |
| Main north/south circulation | irregular stone lane, usually `125..190px` wide | about 4–6 tiles, narrowed by planters and walls without a one-tile choke | v1 repeats 7-tile rectangles with visible 32px square seams |
| Hall-to-tree court | roughly `x=426..1028`, `y=292..690`, with many inset gardens and walls | civic court occupies about 17×13 tiles, but less than half is uninterrupted paving | v1 treats almost the entire rectangle as open paving |
| Secondary alleys | west/east pockets are commonly `60..115px` wide | 2–4 tiles | absent or replaced by broad lawn |
| Boundary construction | continuous mix of mature canopy, stone wall, hedge and wood fence | visually closed perimeter with one southern opening | sparse edge vegetation, no convincing enclosure |
| Surface balance (visual estimate) | paving/dirt about 38%; grass/garden about 34%; forest/walls/buildings about 28% | compact built garden village | v1 is dominated by exposed grass and clean rectangular paving |
| Prop/vegetation rhythm | nearly every 40–80px along lived-in edges has a plant, wall break, sign, bench, lamp, crate or utility object | dense but walkable | v1 leaves multiple 200–400px empty stretches |

## Dynamic pixels that must be removed from the master

The gold marker centers were measured by color-connected components in the original RGB raster. The edit boxes include glow and shadow and should be treated as the only allowed ImageGen change regions.

| Item | Center (px) | Conservative edit box (px) | Logical center |
| --- | --- | --- | --- |
| Marker 1 | `(330,157)` | `x=301..363, y=124..190` | `(10.94,5.21)` |
| Marker 2 | `(997,216)` | `x=964..1030, y=181..250` | `(33.05,7.16)` |
| Marker 3 | `(398,350)` | `x=367..429, y=318..383` | `(13.19,11.60)` |
| Marker 4 | `(723,389)` | `x=691..755, y=355..423` | `(23.97,12.90)` |
| Marker 5 | `(1279,515)` | `x=1245..1313, y=481..549` | `(42.41,17.07)` |
| Marker 6 | `(435,578)` | `x=402..468, y=545..612` | `(14.42,19.16)` |
| Marker 7 | `(1290,714)` | `x=1255..1325, y=680..748` | `(42.76,23.67)` |
| Marker 8 | `(217,860)` | `x=183..251, y=826..895` | `(7.19,28.51)` |
| Marker 9 | `(1116,900)` | `x=1082..1150, y=866..934` | `(36.99,29.83)` |
| Player | center about `(725,972)` | `x=690..760, y=925..1023` | center about `(24.03,32.23)` |

## Collision / occlusion anchors

- Building collision follows only the lower wall, doorstep-side planters and side walls. Roof pixels are not solid by themselves.
- The outer forest/wall boundary is solid. The only south-bound exit is the gate opening around logical `x=22..26`, `y=31..35`.
- The central tree collider is the trunk and raised circular bed, approximately logical `x=21..27`, `y=18..22`; the canopy is foreground-only where it overlaps the player.
- Stone walls, hedges, cafe furniture, benches, large planters, the notice board, laundry facade, garden beds and fence posts are solid where their visible ground contact occurs.
- Walkable polygons follow the visible light-stone and dirt network plus small readable grass pockets. A slightly generous invisible footprint is allowed where reference detail would otherwise create sub-tile snagging.
- Foreground extraction must reuse exact master pixels for roof eaves, awnings, tree canopies and tall front-facing walls so static composition remains unchanged.

## Acceptance anchors

- Landmark center error target: at most 2% of canvas (`29px` reference / `31px` runtime).
- Landmark size error target: at most 5%.
- Masked structural similarity target: at least 0.92 outside the nine marker boxes and player box.
- Static comparison mode must hide player, dynamic sound markers, HUD, fog, exit cue and all debug overlays.
