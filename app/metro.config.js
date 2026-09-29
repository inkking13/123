// Adds .glb so 3D models can be bundled like images.
const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

// three's CommonJS entry (what `require('three')` in @react-three/fiber gets)
// calls process.emitWarning, which React Native doesn't have, so the app died
// with "undefined is not a function" while loading. Always use the ES build.
const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js');
const resolveDefault = config.resolver.resolveRequest;
// Phones load the light copies in assets/models/mobile (tools/models) in
// place of the full models; the web keeps the originals.
const models = path.join(__dirname, 'assets', 'models');
const mobileModels = path.join(models, 'mobile');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  const res = (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
  if (platform !== 'web' && res.type === 'assetFiles' && res.filePaths.length === 1) {
    const file = res.filePaths[0];
    if (file.endsWith('.glb') && file.startsWith(models + path.sep) && !file.startsWith(mobileModels + path.sep)) {
      const light = path.join(mobileModels, path.relative(models, file));
      if (fs.existsSync(light)) return { type: 'assetFiles', filePaths: [light] };
    }
  }
  return res;
};

module.exports = config;
