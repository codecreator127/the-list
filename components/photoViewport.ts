const listeners = new Set<() => void>();
export function subscribePhotoViewport(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function notifyPhotoViewport() { listeners.forEach(listener => listener()); }
