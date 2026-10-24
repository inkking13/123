# Wardrobe: fitting a Meshy outfit onto the game's bodies

An outfit starts as a Meshy character (Text to 3D, then auto-rig at 1.7 m) wearing
the clothes. The raw files live on the `armour-raw` branch in `models/raw/armour/`.

`fit.py` turns one rigged outfit into one `godot/assets/models/wardrobe/<set>-<body>.glb`:

- each outfit bone is turned, stretched and widened onto the body's bone (the trunk
  moves as one, from the hips to the neck), and the outfit is skinned with its own
  weights on the body's skeleton;
- nothing may sink into the body: what does is pushed out along the body's normals;
- the outfit's own face is dropped, so the hero's face shows;
- triangles are split into pieces (`hood`, `jacket`, `shoulders`, `gloves`, `pants`,
  `boots`, and `collar`/`sleeves` for bare heads and hands) by the body part under
  them, the same parts `Unit._part_of` cuts away;
- textures are cut down to 1024².

```
python3 tools/wardrobe/fit.py <set>-rigged.glb godot/assets/models/<body>.glb \
    godot/assets/models/wardrobe/<set>-<body>.glb [flags]
```

Bodies: `human`, `elf`, `elf-male`, `dwarf`, `orc`. Flags used so far:

| Set | Flags |
|---|---|
| chainmail | `--head-lift=0.03` (the helmet's brim sat on the eyes) |
| wanderer | `--drop-head --bare-hands` (hood worn down, no gloves) |
| gambeson | `--head-box` (the coif is centred on the head's box) |

Needs numpy, scipy and Pillow. Icons: `icons.gd` (see its header).
A new set also needs a line in `Unit.CLOSED_HELM` and `Unit._piece_finish`, and its
entries in `data/armourSets.json` and `data/gear.json`.
