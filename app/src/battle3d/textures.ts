import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { useLoader } from './r3f';

// On native the fiber polyfill resolves bundler module ids itself; on the web
// the loader wants a URL, which expo-asset gives us.
const toUrl = (mod: any): any => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : mod);

export function useArt(mod: any): THREE.Texture {
  const tex = useLoader(THREE.TextureLoader, toUrl(mod)) as THREE.Texture;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
