// Dumps the Expo game's static data (app/src/data, compiled to CommonJS by
// export_data.sh) to godot/data/*.json, so the Godot port reads the same
// heroes, gear, dungeons and talents. Functions can't travel as JSON: those
// parts (quest checks, event builders) live in GDScript and are listed here.
const Module = require('module');
const path = require('path');
const fs = require('fs');
const [, , compiled, out] = process.argv;

// Images and models: keep the path relative to app/assets.
const asset = (m, file) => { m.exports = { asset: file.split('/assets/')[1] }; };
for (const ext of ['.png', '.jpg', '.jpeg', '.glb', '.mp3', '.ogg', '.wav']) Module._extensions[ext] = asset;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (/\.(png|jpe?g|glb|mp3|ogg|wav)$/.test(req)) return path.resolve(path.dirname(parent.filename).replace(compiled, path.resolve(__dirname, '../../app/src')), req);
  if (['react-native', 'react', 'expo-haptics', '@react-native-async-storage/async-storage'].includes(req)) return path.join(__dirname, 'stub.cjs');
  return origResolve.call(this, req, parent, ...rest);
};
fs.writeFileSync(path.join(__dirname, 'stub.cjs'), 'module.exports = new Proxy({}, { get: () => ({}) });');

const skipped = [];
const clean = (v, where) => {
  if (typeof v === 'function') { skipped.push(where); return null; }
  if (Array.isArray(v)) return v.map((x, i) => clean(x, where + '[' + i + ']'));
  if (v && typeof v === 'object') {
    if (v instanceof Set) return [...v];
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = clean(x, where + '.' + k);
    return o;
  }
  return v;
};
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(path.join(compiled, 'data'))) {
  if (!f.endsWith('.js')) continue;
  const mod = require(path.join(compiled, 'data', f));
  const name = f.replace(/\.js$/, '');
  const data = {};
  for (const [k, v] of Object.entries(mod)) if (k !== '__esModule') data[k] = clean(v, name + '.' + k);
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(data, null, 1));
}
fs.unlinkSync(path.join(__dirname, 'stub.cjs'));
console.log('functions left to GDScript:\n  ' + [...new Set(skipped.map((s) => s.replace(/\[\d+\]/g, '[]')))].join('\n  '));
