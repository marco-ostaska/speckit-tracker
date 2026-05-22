const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const rateLimit = require('express-rate-limit');

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

function loadFeatures() {
  const rootResolved = path.resolve(currentRoot);
  const specsDir = path.resolve(rootResolved, 'specs');
  if (!specsDir.startsWith(rootResolved + path.sep)) throw new Error('invalid root');
  const specsDirBound = specsDir + path.sep;
  const entries = fs.readdirSync(specsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d+-.+/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map(e => {
    const featDir = path.resolve(specsDir, e.name);
    if (!featDir.startsWith(specsDirBound)) return null;

    const artifacts = {};
    for (const f of ARTIFACT_FILES) {
      const p = path.resolve(featDir, f);
      if (p.startsWith(featDir + path.sep)) {
        const content = readFileOpt(p);
        if (content !== null) artifacts[f] = content;
      }
    }

    const checklists = {};
    for (const f of readDir(path.resolve(featDir, 'checklists')).filter(f => f.endsWith('.md'))) {
      const p = path.resolve(featDir, 'checklists', f);
      if (p.startsWith(featDir + path.sep)) checklists[f] = readFileOpt(p) || '';
    }

    const contracts = {};
    for (const f of readDir(path.resolve(featDir, 'contracts')).filter(f => f.endsWith('.md'))) {
      const p = path.resolve(featDir, 'contracts', f);
      if (p.startsWith(featDir + path.sep)) contracts[f] = readFileOpt(p) || '';
    }

    return { id: e.name, artifacts, checklists, contracts };
  }).filter(Boolean);
}

// nosemgrep: express-check-csurf-middleware-usage — local single-user tool, no cross-origin state
const app = express();
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (req, res) => {
  res.json({ root: currentRoot });
});

app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.delete('/api/history', (req, res) => {
  const { root } = req.body;
  if (!root || typeof root !== 'string') return res.status(400).json({ error: 'root required' });
  const next = readHistory().filter(h => h.root !== root);
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(next, null, 2));
  res.json({ ok: true });
});

app.post('/api/open', (req, res) => {
  const { root: rawRoot } = req.body;
  if (!rawRoot || typeof rawRoot !== 'string') {
    return res.status(400).json({ error: 'root path required' });
  }
  const resolved = path.resolve(expandHome(rawRoot.trim()));
  const specsCheck = path.resolve(resolved, 'specs');
  if (!specsCheck.startsWith(resolved + path.sep)) {
    return res.status(400).json({ error: 'invalid path' });
  }
  if (!fs.existsSync(specsCheck)) {
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

  const specsDir = path.resolve(currentRoot, 'specs');
  const featDir = path.resolve(specsDir, id);
  if (!featDir.startsWith(specsDir + path.sep)) {
    return res.status(400).json({ error: 'invalid feature id' });
  }
  if (!fs.existsSync(featDir)) {
    return res.status(404).json({ error: 'feature not found' });
  }

  const target = path.resolve(featDir, relPath);
  if (!target.startsWith(featDir + path.sep)) {
    return res.status(400).json({ error: 'invalid path' });
  }

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
