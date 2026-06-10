const assert = require('node:assert/strict');
const test = require('node:test');

const {
  THEME_STORAGE_KEY,
  readStoredTheme,
  writeStoredTheme,
} = require('../public/theme-preference');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    value: key => values.get(key),
  };
}

test('reads a previously selected theme', () => {
  const store = storage({ [THEME_STORAGE_KEY]: 'light' });
  assert.equal(readStoredTheme(store), 'light');
});

test('ignores missing, invalid, or unavailable storage', () => {
  assert.equal(readStoredTheme(storage()), null);
  assert.equal(readStoredTheme(storage({ [THEME_STORAGE_KEY]: 'system' })), null);
  assert.equal(readStoredTheme({ getItem() { throw new Error('blocked'); } }), null);
});

test('writes only supported themes', () => {
  const store = storage();
  assert.equal(writeStoredTheme(store, 'dark'), true);
  assert.equal(store.value(THEME_STORAGE_KEY), 'dark');
  assert.equal(writeStoredTheme(store, 'system'), false);
  assert.equal(store.value(THEME_STORAGE_KEY), 'dark');
  assert.equal(writeStoredTheme({ setItem() { throw new Error('blocked'); } }, 'light'), false);
});
