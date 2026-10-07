# Render band order

The production order is:

1. terrain panels and preview
2. baked environment clusters
3. object `ground` layers
4. one stable queue containing object `world` layers and characters
5. object `foreground`/`occluder` layers
6. existing global foreground (`foreground-south-gate`)
7. object `overlay`/`effect` layers
8. existing reference/interaction/debug UI

The pure constant is:

```text
terrain -> environment -> ground -> world -> object-foreground
-> global-foreground -> overlay -> interaction-debug
```

Current production has no object ground, object foreground, or overlay layers, so no empty groups or image nodes are added. The south gate remains after any future object foreground and before overlays. Its one node and world rect remain unchanged at `x=1458.5635359116022`, `y=2439.779005524862`, `width=974.5856353591159`, `height=440.2209944751381`.

QA defaults:

- `ground`: `all` and `objects`, unless clean.
- `world/body`: gameplay in `all`/`objects`; inspection only in `objects`.
- `foreground/occluder`: `all` and `foreground`, unless clean.
- `overlay/effect`: only when its declarative state rule matches, in `all`/`objects`.
- `collision` and `reference`: no modular object layers.
- `clean`: preserves the existing terrain/environment comparison surface and omits modular layers and characters.
