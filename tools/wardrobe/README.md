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
| chainmail | `--head-lift=0.02 --head-scale=1.0 --head-upright` (the helmet sat big and low, tipped forward) |
| wanderer | `--drop-head --bare-hands` (hood worn down, no gloves) |
| gambeson | `--head-box` (the coif is centred on the head's box) |
| peasant | `--drop-head --bare-hands --open-sleeves` (no hood; short sleeves, so the forearms stay; the female cut on `elf` without `--open-sleeves`) |
| ranger | `--bare-hands` |

`--open-sleeves` puts short sleeves with the shoulders, so the body keeps its forearms.
`--layered` (not used now) moves layers that lie on each other out together.

## Ready-made outfits (Quaternius)

Peasant and ranger come from the owner's *Modular Character Outfits – Fantasy* (CC0,
Quaternius), on the UE-style skeleton. The raw glTF files are on the `outfits-raw`
branch in `models/raw/outfits/`. `kit.py` turns one into a rigged GLB that `fit.py`
reads like a Meshy outfit: Mixamo bone names, the bare body (`MI_Regular_*`) dropped,
fingers folded into the hand, a head-top bone, layers hidden under other layers cut
away (they show through in patches once fitted), and meshoptimizer down to ~8.5k
triangles; textures 1024².

```
python3 tools/wardrobe/kit.py Male_Ranger.gltf ranger-m.glb --tris=8500 --skip=Male_Ranger_Body_Belt_1.001
python3 tools/wardrobe/fit.py ranger-m.glb godot/assets/models/human.glb godot/assets/models/wardrobe/ranger-human.glb --bare-hands
```

Male cuts go on `human`, `elf-male`, `dwarf`, `orc`; the female cut on `elf`. The second
belt in each ranger file is an alternative and is skipped. `--base=` swaps in the kit's
other colourings (`T_Peasant_2_BaseColor`, `T_Ranger_3_BaseColor`).

Needs numpy, scipy, Pillow, trimesh with rtree, and meshoptimizer (pip). Icons: `icons.gd` (see its header).
A new set also needs a line in `Unit.CLOSED_HELM` and `Unit._piece_finish`, and its
entries in `data/armourSets.json` and `data/gear.json`.
