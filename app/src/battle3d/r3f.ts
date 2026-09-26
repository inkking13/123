// Native build: the expo-gl backed renderer (it also polyfills texture loading
// through expo-asset). Web uses r3f.web.ts. Everything in battle3d imports
// fiber through here so hooks and the Canvas always come from the same build.
export * from '@react-three/fiber/native';
