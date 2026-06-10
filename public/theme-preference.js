(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const THEME_STORAGE_KEY = 'speckit-tracker.theme';
  const THEMES = new Set(['dark', 'light']);

  function resolveStorage(storage) {
    return storage === undefined ? root.localStorage : storage;
  }

  function readStoredTheme(storage) {
    try {
      const target = resolveStorage(storage);
      const theme = target && target.getItem(THEME_STORAGE_KEY);
      return THEMES.has(theme) ? theme : null;
    } catch {
      return null;
    }
  }

  function writeStoredTheme(storage, theme) {
    if (!THEMES.has(theme)) return false;
    try {
      resolveStorage(storage).setItem(THEME_STORAGE_KEY, theme);
      return true;
    } catch {
      return false;
    }
  }

  return { THEME_STORAGE_KEY, readStoredTheme, writeStoredTheme };
});
