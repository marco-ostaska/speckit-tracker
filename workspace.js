const fs = require('fs');
const path = require('path');

const ARTIFACT_FILES = ['spec.md', 'plan.md', 'tasks.md', 'data-model.md', 'research.md', 'quickstart.md'];

function readFileOpt(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function readDir(dirPath) {
  try { return fs.readdirSync(dirPath); } catch { return []; }
}

function isDirectory(dirPath) {
  try { return fs.statSync(dirPath).isDirectory(); } catch { return false; }
}

function isValidWorkspaceRoot(root) {
  const resolved = path.resolve(root);
  return [path.join(resolved, 'specs'), path.join(resolved, 'docs', 'prd')].some(isDirectory);
}

function loadFeatures(root) {
  const rootResolved = path.resolve(root);
  const specsDir = path.resolve(rootResolved, 'specs');
  if (!specsDir.startsWith(rootResolved + path.sep)) throw new Error('invalid root');
  if (!isDirectory(specsDir)) return [];

  const specsDirBound = specsDir + path.sep;
  const entries = fs.readdirSync(specsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+-.+/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map(entry => {
    const featDir = path.resolve(specsDir, entry.name);
    if (!featDir.startsWith(specsDirBound)) return null;

    const artifacts = {};
    for (const filename of ARTIFACT_FILES) {
      const filePath = path.resolve(featDir, filename);
      if (filePath.startsWith(featDir + path.sep)) {
        const content = readFileOpt(filePath);
        if (content !== null) artifacts[filename] = content;
      }
    }

    const checklists = {};
    for (const filename of readDir(path.resolve(featDir, 'checklists')).filter(name => name.endsWith('.md'))) {
      const filePath = path.resolve(featDir, 'checklists', filename);
      if (filePath.startsWith(featDir + path.sep)) checklists[filename] = readFileOpt(filePath) || '';
    }

    const contracts = {};
    for (const filename of readDir(path.resolve(featDir, 'contracts')).filter(name => name.endsWith('.md'))) {
      const filePath = path.resolve(featDir, 'contracts', filename);
      if (filePath.startsWith(featDir + path.sep)) contracts[filename] = readFileOpt(filePath) || '';
    }

    return { id: entry.name, artifacts, checklists, contracts };
  }).filter(Boolean);
}

function prdTitle(content, filename) {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].replace(/\*\*/g, '').replace(/`/g, '') : filename.replace(/\.md$/i, '');
}

function loadPrds(root) {
  const rootResolved = path.resolve(root);
  const prdDir = path.resolve(rootResolved, 'docs', 'prd');
  if (!prdDir.startsWith(rootResolved + path.sep)) throw new Error('invalid root');
  if (!isDirectory(prdDir)) return [];

  return fs.readdirSync(prdDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => {
      const filePath = path.resolve(prdDir, entry.name);
      if (!filePath.startsWith(prdDir + path.sep)) return null;
      const content = readFileOpt(filePath);
      if (content === null) return null;
      const stats = fs.statSync(filePath);
      return {
        filename: entry.name,
        title: prdTitle(content, entry.name),
        content,
        createdAt: stats.birthtime.toISOString(),
        createdAtMs: stats.birthtimeMs,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.createdAtMs - b.createdAtMs || a.title.localeCompare(b.title))
    .map(({ createdAtMs, ...prd }) => prd);
}

function loadWorkspace(root) {
  return { features: loadFeatures(root), prds: loadPrds(root) };
}

function resolvePrdPath(root, filename) {
  if (typeof filename !== 'string' || !/^[^/\\]+\.md$/i.test(filename)) {
    throw new Error('invalid PRD filename');
  }
  const prdDir = path.resolve(root, 'docs', 'prd');
  const target = path.resolve(prdDir, filename);
  if (!target.startsWith(prdDir + path.sep)) throw new Error('invalid PRD path');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('PRD not found');
  const realPrdDir = fs.realpathSync(prdDir);
  const realTarget = fs.realpathSync(target);
  if (!realTarget.startsWith(realPrdDir + path.sep)) throw new Error('invalid PRD path');
  return realTarget;
}

function writePrd(root, filename, content) {
  if (typeof content !== 'string') throw new Error('content required');
  fs.writeFileSync(resolvePrdPath(root, filename), content, 'utf8');
}

module.exports = {
  ARTIFACT_FILES,
  isValidWorkspaceRoot,
  loadFeatures,
  loadPrds,
  loadWorkspace,
  resolvePrdPath,
  writePrd,
};
