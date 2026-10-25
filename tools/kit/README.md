# Quaternius kits on the map

The owner's two free Quaternius packs (CC0), from `C:\gg1` on their PC:

- **Stylized Nature MegaKit** (`C:\gg1\glTF`): trees, bushes, flowers,
  ferns, mushrooms, rocks, pebbles, stepping stones.
- **Medieval Village MegaKit** (`C:\gg1\Medieval Village MegaKit[Standard]\glTF`):
  wall, roof, door and window pieces, a wagon, crates, fences.

## How the models were made

1. `gltf2glb.py` packs each kit `.gltf` into one `.glb`: colour textures
   only (no normal or roughness maps), shrunk to 512 px for nature models
   and props, 1024 px for house pieces, glass made an opaque warm pane.
   Nature models land in `godot/assets/models/nature-*.glb`, props in
   `kit-crate.glb`, `kit-wagon.glb`, `kit-fence.glb`.
2. `build_houses.gd` assembles whole houses from the packed pieces (walls on
   a 2 m grid, storeys of 3 m, roof, gables, chimney, door, windows) and
   saves each as one mesh with one surface per material:
   `kit-cottage`, `kit-cottage-stone`, `kit-house`, `kit-townhouse`,
   `kit-tavern`, `kit-barracks`. Edit the `HOUSES` table to add one.
3. `preview.gd` lays a few `.glb` files in a row and saves a picture.

```
python3 -I tools/kit/gltf2glb.py "<kit>/glTF/Pine_5.gltf" godot/assets/models/nature-pine-5.glb --max 512
godot --headless --path godot -s ../tools/kit/build_houses.gd -- <packed pieces> <out dir>
xvfb-run godot --path godot --rendering-driver opengl3 -s ../tools/kit/preview.gd -- out.png a.glb b.glb
```

In the game, `WorldView._model_mesh` keeps a surface per material, `_shared`
loads each house material once (and calms the red tiles), and `_plant`
gives kit plants the wind shader (`wind_cut.gdshader` for leaves on cards).
