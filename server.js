const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const rateLimit = require('express-rate-limit');
const { isValidWorkspaceRoot, loadWorkspace, writePrd } = require('./workspace');

const HISTORY_FILE = path.join(os.homedir(), '.speckit-tracker', 'history.json');

// Server state — set at startup (CLI arg) or via POST /api/open
let currentRoot = null;

function expandHome(p) {
  return path.resolve(p.replace(/^~/, os.homedir()));
}

// If a project path was passed at startup, pre-open it (CLI arg, not user HTTP input)
const ROOT_ARG = process.argv[2];
if (ROOT_ARG) {
  currentRoot = expandHome(ROOT_ARG);
  if (!isValidWorkspaceRoot(currentRoot)) {
    console.error(`No specs/ or docs/prd/ directory found at ${currentRoot}`);
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
  if (!isValidWorkspaceRoot(resolved)) {
    return res.status(400).json({ error: `No specs/ or docs/prd/ directory found at ${resolved}` });
  }

  // Commit currentRoot so workspace loading can use it; roll back on error.
  const prevRoot = currentRoot;
  currentRoot = resolved;
  try {
    const workspace = loadWorkspace(currentRoot);
    saveHistory(resolved, workspace.features.length);
    res.json({ root: currentRoot, ...workspace });
  } catch (err) {
    currentRoot = prevRoot;
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/features', (req, res) => {
  if (!currentRoot) return res.status(400).json({ error: 'no project open' });
  try {
    res.json({ root: currentRoot, ...loadWorkspace(currentRoot) });
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

app.put('/api/prds/:filename/write', (req, res) => {
  if (!currentRoot) return res.status(400).json({ error: 'no project open' });
  if (typeof req.body.content !== 'string') return res.status(400).json({ error: 'content required' });

  try {
    writePrd(currentRoot, req.params.filename, req.body.content);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message === 'PRD not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
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
