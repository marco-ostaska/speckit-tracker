const assert = require('node:assert/strict');
const test = require('node:test');

const { focusModeReducer } = require('../public/focus-mode');

test('toggles focus mode on and off', () => {
  assert.equal(focusModeReducer(false, { type: 'toggle' }), true);
  assert.equal(focusModeReducer(true, { type: 'toggle' }), false);
});

test('Escape exits focus mode', () => {
  assert.equal(focusModeReducer(true, { type: 'escape' }), false);
});

test('navigation and document changes exit focus mode', () => {
  assert.equal(focusModeReducer(true, { type: 'navigate' }), false);
  assert.equal(focusModeReducer(true, { type: 'document-change' }), false);
});
