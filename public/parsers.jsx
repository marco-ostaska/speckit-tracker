// Parsers for speckit artifacts: tasks.md, headings outline, etc.

function parseTasks(md) {
  if (!md) return { phases: [], total: 0, done: 0, byStory: {} };
  const lines = md.split(/\r?\n/);
  const phases = [];
  let currentPhase = null;
  const taskRe = /^- \[([ xX])\] (T\d+\w*)(?:\s+\[P\])?(?:\s+\[([^\]]+)\])?\s+(.*)$/;
  const phaseRe = /^##\s+(Phase\s+\d+[^]*?)$/i;

  for (const line of lines) {
    const pm = line.match(phaseRe);
    if (pm) {
      currentPhase = { name: pm[1].replace(/\*\*/g, '').trim(), tasks: [] };
      phases.push(currentPhase);
      continue;
    }
    const tm = line.match(taskRe);
    if (tm && currentPhase) {
      currentPhase.tasks.push({
        id: tm[2],
        parallel: line.includes('[P]'),
        story: tm[3] || null,
        desc: tm[4],
        done: tm[1].toLowerCase() === 'x',
      });
    } else if (tm) {
      // Task without a phase header — bucket under "Tasks"
      if (!currentPhase) {
        currentPhase = { name: 'Tasks', tasks: [] };
        phases.push(currentPhase);
      }
      currentPhase.tasks.push({
        id: tm[2],
        parallel: line.includes('[P]'),
        story: tm[3] || null,
        desc: tm[4],
        done: tm[1].toLowerCase() === 'x',
      });
    }
  }
  let total = 0, done = 0;
  const byStory = {};
  for (const p of phases) {
    for (const t of p.tasks) {
      total++;
      if (t.done) done++;
      const k = t.story || 'unscoped';
      if (!byStory[k]) byStory[k] = { total: 0, done: 0 };
      byStory[k].total++;
      if (t.done) byStory[k].done++;
    }
  }
  return { phases, total, done, byStory };
}

function parseChecklist(md) {
  if (!md) return { total: 0, done: 0, items: [] };
  const lines = md.split(/\r?\n/);
  const items = [];
  const re = /^- \[([ xX])\]\s+(.*)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) items.push({ done: m[1].toLowerCase() === 'x', text: m[2] });
  }
  const done = items.filter(i => i.done).length;
  return { total: items.length, done, items };
}

function featureTitle(feature) {
  const spec = feature.artifacts['spec.md'] || '';
  const m = spec.match(/^#\s+(.+)$/m);
  if (m) {
    return m[1].replace(/^Feature Specification:\s*/i, '').replace(/^\[FEATURE NAME\]/i, 'Untitled Draft');
  }
  return feature.id;
}

function featureMeta(feature) {
  const spec = feature.artifacts['spec.md'] || '';
  const branchM = spec.match(/Feature Branch[^`]*`([^`]+)`/);
  const dateM = spec.match(/Created\*?\*?:\s*\*?\*?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
  const statusM = spec.match(/Status\*?\*?:\s*\*?\*?\s*([A-Za-z]+)/);
  return {
    branch: branchM ? branchM[1] : null,
    created: dateM ? dateM[1] : null,
    status: statusM ? statusM[1] : 'Draft',
  };
}

function featureSummary(feature) {
  // First non-heading paragraph from spec.md, ignoring frontmatter & headings.
  const spec = feature.artifacts['spec.md'] || '';
  const lines = spec.split(/\r?\n/);
  let collecting = false;
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^Input\*?\*?:/i.test(l)) {
      // Use Input description
      return l.replace(/^\*\*Input\*\*:\s*/, '').replace(/^Input:\s*/, '').slice(0, 240);
    }
  }
  return '';
}

function aggregateProgress(features) {
  let totalT = 0, doneT = 0, totalCl = 0, doneCl = 0, featuresWithTasks = 0;
  const perFeature = [];
  for (const f of features) {
    const t = parseTasks(f.artifacts['tasks.md']);
    let clT = 0, clD = 0;
    for (const k of Object.keys(f.checklists)) {
      const c = parseChecklist(f.checklists[k]);
      clT += c.total; clD += c.done;
    }
    totalT += t.total; doneT += t.done;
    totalCl += clT; doneCl += clD;
    if (t.total > 0) featuresWithTasks++;
    perFeature.push({ id: f.id, tasks: t, checklist: { total: clT, done: clD } });
  }
  return { totalT, doneT, totalCl, doneCl, featuresWithTasks, perFeature };
}

Object.assign(window, { parseTasks, parseChecklist, featureTitle, featureMeta, featureSummary, aggregateProgress });
