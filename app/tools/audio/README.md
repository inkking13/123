# Game audio generator

Every sound effect and music loop in `assets/audio` is synthesized by these scripts (no samples, no third-party audio).

```
npm i @breezystack/lamejs      # MP3 encoder, in any scratch folder
node sfx.mjs ../../assets/audio     # 22 effects
node music.mjs ../../assets/audio   # camp, battle and boss loops
```

`dsp.mjs` holds the building blocks (oscillators, filters, reverb, Karplus-Strong pluck, MP3 writer).
