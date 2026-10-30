import { useSyncExternalStore } from 'react';

// True while the screen matches a CSS media query, e.g. useMediaQuery('(max-width: 767px)').
// Updates by itself when the window is resized or the phone is rotated.
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
