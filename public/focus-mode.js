(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function focusModeReducer(state, action) {
    switch (action.type) {
      case 'toggle': return !state;
      case 'escape':
      case 'navigate':
      case 'document-change': return false;
      default: return state;
    }
  }

  return { focusModeReducer };
});
