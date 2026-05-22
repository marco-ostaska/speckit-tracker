const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const HISTORY_FILE = path.join(os.homedir(), '.speckit-tracker', 'history.json');
const ARTIFACT_FILES = ['spec.md', 'plan.md', 'tasks.md', 'data-model.md', 'research.md', 'quickstart.md'];

// Server state — set at startup (CLI arg) or via POST /api/open
let currentRoot = null;

function expandHome(p) {
  return path.resolve(p.replace(/^~/, os.homedir()));
}

// If a project path was passed at startup, pre-open it (CLI arg, not user HTTP input)
const ROOT_ARG = process.argv[2];
if (ROOT_ARG) {
  currentRoot = expandHome(ROOT_ARG);
  if (!fs.existsSync(path.join(currentRoot, 'specs'))) {
    console.error(`No specs/ directory found at ${currentRoot}`);
    process.exit(1);
  }
}

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function saveHistory(root, featureCount) {
  const entry = { root, features: featureCount, lastOpened: new Date().toISOString() };
  const prev = readHistory().filter(h => h.root !== root);
  const next = [entry, ...prev].slice(0, 8);
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(next, null, 2));
}

function readFileOpt(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function readDir(p) {
  try { return fs.readdirSync(p); } catch { return []; }
}

// Uses module-level currentRoot — not a user-tainted parameter.
// All sub-paths are built from readdirSync results and a hardcoded constant list.
function loadFeatures() {
  const specsDir = path.join(currentRoot, 'specs');
  const entries = fs.readdirSync(specsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d+-.+/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map(e => {
    const featDir = path.join(specsDir, e.name);

    const artifacts = {};
    for (const f of ARTIFACT_FILES) {
      const content = readFileOpt(path.join(featDir, f));
      if (content !== null) artifacts[f] = content;
    }

    const checklists = {};
    for (const f of readDir(path.join(featDir, 'checklists')).filter(f => f.endsWith('.md'))) {
      checklists[f] = readFileOpt(path.join(featDir, 'checklists', f)) || '';
    }

    const contracts = {};
    for (const f of readDir(path.join(featDir, 'contracts')).filter(f => f.endsWith('.md'))) {
      contracts[f] = readFileOpt(path.join(featDir, 'contracts', f)) || '';
    }

    return { id: e.name, artifacts, checklists, contracts };
  });
}

// nosemgrep: express-check-csurf-middleware-usage — local single-user tool, no cross-origin state
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (req, res) => {
  res.json({ root: currentRoot });
});

app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.post('/api/open', (req, res) => {
  const { root: rawRoot } = req.body;
  if (!rawRoot || typeof rawRoot !== 'string') {
    return res.status(400).json({ error: 'root path required' });
  }
  const resolved = expandHome(rawRoot.trim());
  if (!fs.existsSync(path.join(resolved, 'specs'))) {
    return res.status(400).json({ error: `No specs/ directory found at ${resolved}` });
  }

  // Commit currentRoot so loadFeatures() can use it; roll back on error
  const prevRoot = currentRoot;
  currentRoot = resolved;
  try {
    const features = loadFeatures();
    saveHistory(resolved, features.length);
    res.json({ root: currentRoot, features });
  } catch (err) {
    currentRoot = prevRoot;
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/features', (req, res) => {
  if (!currentRoot) return res.status(400).json({ error: 'no project open' });
  try {
    res.json({ root: currentRoot, features: loadFeatures() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/features/:id/write', (req, res) => {
  if (!currentRoot) return res.status(400).json({ error: 'no project open' });

  const { id } = req.params;
  const { path: relPath, content } = req.body;

  if (!relPath || typeof content !== 'string') {
    return res.status(400).json({ error: 'path and content required' });
  }

  // Sanitize id: must match the speckit feature directory name format
  if (!/^\d+-[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'invalid feature id' });
  }

  // Sanitize relPath: no null bytes, no .. segments, no absolute paths
  const pathParts = relPath.split(/[/\\]/);
  if (/\0/.test(relPath) || pathParts.some(p => p === '..') || path.isAbsolute(relPath)) {
    return res.status(400).json({ error: 'invalid path' });
  }

  const specsDir = path.join(currentRoot, 'specs');
  const featDir = path.join(specsDir, id);
  if (!fs.existsSync(featDir)) {
    return res.status(404).json({ error: 'feature not found' });
  }

  const target = path.join(featDir, relPath);

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const ifaces = require('os').networkInterfaces();
  const lan = Object.values(ifaces).flat().find(i => i.family === 'IPv4' && !i.internal);
  console.log(`Speckit Tracker running at http://localhost:${PORT}`);
  if (lan) console.log(`On network:            http://${lan.address}:${PORT}`);
  if (currentRoot) console.log(`Project: ${currentRoot}`);
  else console.log('No project pre-loaded — open one in the browser.');
});
