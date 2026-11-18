import { useSyncExternalStore } from 'react';
import { originalsLoaded, subscribeOriginals } from './sprites';

// True once punks.png has loaded, so original-punk canvases can (re)draw.
export function useOriginalsReady() {
  return useSyncExternalStore(subscribeOriginals, originalsLoaded);
}
