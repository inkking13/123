# Phone copies of the 3D models

`assets/models/mobile/` holds lighter copies of the character, armour, helm,
weapon and decor models: a few thousand triangles each instead of 10–35k,
512px JPEG textures, no normal maps. `metro.config.js` swaps them in on
Android and iOS; the web keeps the full models.

After adding or changing a model, regenerate them:

```
npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp   # in any scratch folder
node mobile.mjs ../../assets/models
```
