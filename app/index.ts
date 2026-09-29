import React from 'react';
import { registerRootComponent } from 'expo';
import { CrashGuard, installCrashHandler, reportFatal } from './src/components/CrashScreen';

// Catch errors before the game's own modules load, so even a crash while
// importing them (or building the engine) shows the error screen instead of
// closing the app.
installCrashHandler();

let App: React.ComponentType = () => null;
try {
  App = require('./App').default;
} catch (e) {
  reportFatal(e);
}

function Root() {
  return React.createElement(CrashGuard, null, React.createElement(App));
}

registerRootComponent(Root);
