// URL for a file under /data. The ?v= content hash (set in vite.config.js) busts the
// browser's cache whenever a data file changes, which is what makes the long
// Cache-Control on /data/* safe. Every browser fetch of /data must go through this.
const basePath = import.meta.env.DEV ? '../..' : '';

export const dataUrl = (p) => `${basePath}/data/${p}?v=${__DATA_VERSION__}`;
