const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  isValidWorkspaceRoot,
  loadWorkspace,
  resolvePrdPath,
  writePrd,
} = require('../workspace');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-tracker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

test('accepts workspaces containing specs, PRDs, or both', (t) => {
  const specsOnly = tempRoot(t);
  const prdsOnly = tempRoot(t);
  const empty = tempRoot(t);
  fs.mkdirSync(path.join(specsOnly, 'specs'));
  fs.mkdirSync(path.join(prdsOnly, 'docs', 'prd'), { recursive: true });

  assert.equal(isValidWorkspaceRoot(specsOnly), true);
  assert.equal(isValidWorkspaceRoot(prdsOnly), true);
  assert.equal(isValidWorkspaceRoot(empty), false);
});

test('does not accept files named like workspace directories', (t) => {
  const root = tempRoot(t);
  write(root, 'specs', 'not a directory');

  assert.equal(isValidWorkspaceRoot(root), false);
  assert.deepEqual(loadWorkspace(root), { features: [], prds: [] });
});

test('loads direct PRD markdown files oldest first with H1 and filename fallback', async (t) => {
  const root = tempRoot(t);
  write(root, 'docs/prd/first.md', '# First PRD\n\nOldest.');
  await new Promise(resolve => setTimeout(resolve, 20));
  write(root, 'docs/prd/second.md', 'No heading here.');
  write(root, 'docs/prd/ignored.txt', '# Not markdown');
  write(root, 'docs/prd/nested/ignored.md', '# Nested');

  const workspace = loadWorkspace(root);

  assert.deepEqual(workspace.features, []);
  assert.deepEqual(workspace.prds.map(prd => prd.filename), ['first.md', 'second.md']);
  assert.deepEqual(workspace.prds.map(prd => prd.title), ['First PRD', 'second']);
  assert.equal(workspace.prds[0].content, '# First PRD\n\nOldest.');
  assert.ok(workspace.prds[0].createdAt <= workspace.prds[1].createdAt);
});

test('loads features when docs/prd is absent', (t) => {
  const root = tempRoot(t);
  write(root, 'specs/001-example/spec.md', '# Feature Specification: Example');

  const workspace = loadWorkspace(root);

  assert.equal(workspace.features.length, 1);
  assert.equal(workspace.features[0].id, '001-example');
  assert.deepEqual(workspace.prds, []);
});

test('resolves only existing direct markdown files inside docs/prd', (t) => {
  const root = tempRoot(t);
  write(root, 'docs/prd/valid.md', '# Valid');
  write(root, 'docs/prd/nested/hidden.md', '# Hidden');

  assert.equal(resolvePrdPath(root, 'valid.md'), path.join(root, 'docs', 'prd', 'valid.md'));
  for (const filename of ['../outside.md', 'nested/hidden.md', 'valid.txt', 'missing.md']) {
    assert.throws(() => resolvePrdPath(root, filename));
  }
});

test('writes an existing PRD without changing files outside docs/prd', (t) => {
  const root = tempRoot(t);
  write(root, 'docs/prd/valid.md', '# Before');
  write(root, 'outside.md', '# Outside');

  writePrd(root, 'valid.md', '# After');

  assert.equal(fs.readFileSync(path.join(root, 'docs/prd/valid.md'), 'utf8'), '# After');
  assert.equal(fs.readFileSync(path.join(root, 'outside.md'), 'utf8'), '# Outside');
  assert.throws(() => writePrd(root, '../outside.md', '# Changed'));
});

test('rejects a PRD symlink that points outside docs/prd', (t) => {
  const root = tempRoot(t);
  write(root, 'docs/prd/valid.md', '# Valid');
  write(root, 'outside.md', '# Outside');
  fs.symlinkSync(path.join(root, 'outside.md'), path.join(root, 'docs/prd/linked.md'));

  assert.throws(() => resolvePrdPath(root, 'linked.md'));
  assert.throws(() => writePrd(root, 'linked.md', '# Changed'));
  assert.equal(fs.readFileSync(path.join(root, 'outside.md'), 'utf8'), '# Outside');
});
