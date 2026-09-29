// Adds .glb so 3D models can be bundled like images.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

// three's CommonJS entry (what `require('three')` in @react-three/fiber gets)
// calls process.emitWarning, which React Native doesn't have, so the app died
// with "undefined is not a function" while loading. Always use the ES build.
const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js');
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
