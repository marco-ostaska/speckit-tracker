// Feature Detail view — tab nav across all artifacts + raw/preview editor
const { useState: uS2, useMemo: uM2, useEffect: uE2, useRef: uR2 } = React;

const ARTIFACT_TABS = [
  { id: 'spec.md',       label: 'Spec',       icon: 'spec' },
  { id: 'plan.md',       label: 'Plan',       icon: 'plan' },
  { id: 'tasks.md',      label: 'Tasks',      icon: 'tasks' },
  { id: 'data-model.md', label: 'Data model', icon: 'data' },
  { id: 'research.md',   label: 'Research',   icon: 'research' },
  { id: 'quickstart.md', label: 'Quickstart', icon: 'quickstart' },
];

// Outline rail — extract h2/h3 headings from markdown
function extractOutline(md) {
  if (!md) return [];
  const out = [];
  const re = /^(#{2,3})\s+(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(md))) {
    const level = m[1].length;
    const text = m[2].replace(/\*\*/g, '').replace(/`/g, '');
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    out.push({ level, text, slug });
  }
  return out;
}

function renderMarkdown(md) {
  return { __html: window.MD.render(md) };
}

function MarkdownView({ md, onToggleTask }) {
  const ref = uR2(null);
  uE2(() => {
    if (!ref.current) return;
    const handler = (e) => {
      const check = e.target.closest('.md-check');
      if (check) {
        const li = check.closest('.md-task');
        if (!li) return;
        const idx = Array.from(ref.current.querySelectorAll('.md-task')).indexOf(li);
        onToggleTask && onToggleTask(idx);
      }
    };
    ref.current.addEventListener('click', handler);
    return () => ref.current && ref.current.removeEventListener('click', handler);
  }, [md]);
  return <div className="md" ref={ref} dangerouslySetInnerHTML={renderMarkdown(md)}/>;
}

function SplitEditor({ md, onChange }) {
  return (
    <div className="split">
      <div className="pane raw">
        <div className="pane-head">
          <span>raw markdown</span>
          <span style={{color:'var(--text-3)'}}>{md.split('\n').length} lines · {md.length} chars</span>
        </div>
        <textarea value={md} onChange={e => onChange(e.target.value)} spellCheck={false}/>
      </div>
      <div className="pane preview">
        <div className="pane-head">
          <span>preview</span>
          <span style={{color:'var(--text-3)'}}>auto-rendered</span>
        </div>
        <div className="preview-body">
          <MarkdownView md={md}/>
        </div>
      </div>
    </div>
  );
}

function toggleTaskInMarkdown(md, idx) {
  // Walks markdown line-by-line, finds the Nth task line, toggles [ ] / [x]
  const lines = md.split(/\r?\n/);
  const re = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      if (count === idx) {
        lines[i] = lines[i].replace(re, (_, p, c, r) => `${p}[${c.toLowerCase() === 'x' ? ' ' : 'x'}]${r}`);
        return lines.join('\n');
      }
      count++;
    }
  }
  return md;
}

function TasksView({ md, onUpdate }) {
  const parsed = parseTasks(md);
  const [view, setView] = uS2('list'); // list | kanban
  const [filterStory, setFilterStory] = uS2(null);
  const [filterDone, setFilterDone] = uS2('all'); // all | done | open

  const handleToggle = (taskId) => {
    // Find the line with this task id and toggle
    const lines = md.split(/\r?\n/);
    const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // nosemgrep: input is escaped above
    const re = new RegExp(`^(\\s*[-*+]\\s+)\\[([ xX])\\](\\s+${escapedId}\\b.*)$`); // nosemgrep
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (m) {
        lines[i] = `${m[1]}[${m[2].toLowerCase() === 'x' ? ' ' : 'x'}]${m[3]}`;
        onUpdate(lines.join('\n'));
        return;
      }
    }
  };

  const handleMarkAllDone = () => {
    const updated = md.split(/\r?\n/).map(l => l.replace(/^(\s*[-*+]\s+)\[ \](\s+.*)$/, '$1[x]$2')).join('\n');
    onUpdate(updated);
  };

  const stories = Object.keys(parsed.byStory).filter(s => s !== 'unscoped').sort();

  const filtered = (tasks) => tasks.filter(t => {
    if (filterStory && t.story !== filterStory) return false;
    if (filterDone === 'done' && !t.done) return false;
    if (filterDone === 'open' && t.done) return false;
    return true;
  });

  if (view === 'kanban') {
    const cols = [
      { key: 'open', label: 'Open', filter: t => !t.done, color: 'var(--text-2)' },
      { key: 'done', label: 'Done', filter: t => t.done, color: 'var(--success)' },
    ];
    const allTasks = [];
    parsed.phases.forEach(p => p.tasks.forEach(t => allTasks.push({ ...t, phase: p.name })));

    return (
      <div>
        <div className="tasks-toolbar">
          <div className="seg">
            <button className={view==='list'?'active':''} onClick={()=>setView('list')}>List</button>
            <button className={view==='kanban'?'active':''} onClick={()=>setView('kanban')}>Board</button>
          </div>
          {stories.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {stories.map(s => (
                <button key={s}
                  className={'filter-pill' + (filterStory===s?' active':'')}
                  onClick={()=>setFilterStory(filterStory===s?null:s)}>{s}</button>
              ))}
            </div>
          )}
          <div className="stat">{parsed.done}/{parsed.total} done</div>
          {parsed.done < parsed.total && <button className="btn ghost" style={{fontSize:11,padding:'3px 8px'}} onClick={handleMarkAllDone}>Mark all done</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {cols.map(col => {
            const colTasks = filtered(allTasks.filter(col.filter));
            return (
              <div key={col.key} className="card" style={{ padding: 12 }}>
                <h3 style={{ color: col.color }}>{col.label} · {colTasks.length}</h3>
                <div>
                  {colTasks.map(t => (
                    <div key={t.id} className="task-row" data-checked={t.done}
                      onClick={()=>handleToggle(t.id)}>
                      <span className="check" data-checked={t.done}>{t.done && <Icon.check/>}</span>
                      <span className="tid">{t.id}</span>
                      {t.parallel && <span className="tag tag-p">P</span>}
                      {t.story && <span className="tag tag-story">{t.story}</span>}
                      <span className="desc">{t.desc.length > 90 ? t.desc.slice(0,87)+'…' : t.desc}</span>
                    </div>
                  ))}
                  {colTasks.length === 0 && <div style={{ color: 'var(--text-4)', fontSize: 12, padding: '20px 8px', textAlign: 'center' }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // List view (grouped by phase)
  return (
    <div>
      <div className="tasks-toolbar">
        <div className="seg">
          <button className={view==='list'?'active':''} onClick={()=>setView('list')}>List</button>
          <button className={view==='kanban'?'active':''} onClick={()=>setView('kanban')}>Board</button>
        </div>
        <div className="seg">
          <button className={filterDone==='all'?'active':''} onClick={()=>setFilterDone('all')}>All</button>
          <button className={filterDone==='open'?'active':''} onClick={()=>setFilterDone('open')}>Open</button>
          <button className={filterDone==='done'?'active':''} onClick={()=>setFilterDone('done')}>Done</button>
        </div>
        {stories.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {stories.map(s => (
              <button key={s}
                className={'filter-pill' + (filterStory===s?' active':'')}
                onClick={()=>setFilterStory(filterStory===s?null:s)}>{s}</button>
            ))}
          </div>
        )}
        <div className="stat">{parsed.done}/{parsed.total} done · {parsed.phases.length} phases</div>
          {parsed.done < parsed.total && <button className="btn ghost" style={{fontSize:11,padding:'3px 8px'}} onClick={handleMarkAllDone}>Mark all done</button>}
      </div>

      {parsed.phases.map((phase, pi) => {
        const phaseTasks = filtered(phase.tasks);
        if (phaseTasks.length === 0 && (filterDone !== 'all' || filterStory)) return null;
        const pDone = phase.tasks.filter(t=>t.done).length;
        return (
          <div key={pi} className="phase-block">
            <div className="phase-head">
              <span className="pn">{(pi+1).toString().padStart(2,'0')}</span>
              <h4>{phase.name}</h4>
              <div className="progress">
                <div className="bar"><div style={{width:(pDone/Math.max(1,phase.tasks.length)*100)+'%'}}/></div>
                <span>{pDone}/{phase.tasks.length}</span>
              </div>
            </div>
            <div>
              {phaseTasks.map(t => (
                <div key={t.id} className="task-row" data-checked={t.done}
                  onClick={()=>handleToggle(t.id)}>
                  <span className="check" data-checked={t.done}>{t.done && <Icon.check/>}</span>
                  <span className="tid">{t.id}</span>
                  {t.parallel && <span className="tag tag-p">P</span>}
                  {t.story && <span className="tag tag-story">{t.story}</span>}
                  <span className="desc">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {parsed.total === 0 && (
        <div className="empty">
          <div className="glyph">∅</div>
          <h3>No tasks yet</h3>
          <p>Run <code style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>/speckit.tasks</code> in this feature to generate tasks.md.</p>
        </div>
      )}
    </div>
  );
}

function ChecklistsView({ checklists, onUpdate }) {
  const names = Object.keys(checklists);
  const [active, setActive] = uS2(names[0]);

  if (names.length === 0) {
    return (
      <div className="empty">
        <div className="glyph">☐</div>
        <h3>No checklists</h3>
        <p>This feature has no <code style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>checklists/</code> folder yet.</p>
      </div>
    );
  }

  const md = checklists[active];
  const parsed = parseChecklist(md);

  const handleToggle = (idx) => {
    const lines = md.split(/\r?\n/);
    const re = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        if (count === idx) {
          lines[i] = lines[i].replace(re, (_, p, c, r) => `${p}[${c.toLowerCase() === 'x' ? ' ' : 'x'}]${r}`);
          onUpdate(active, lines.join('\n'));
          return;
        }
        count++;
      }
    }
  };

  return (
    <div>
      <div className="subtabs">
        {names.map(n => {
          const p = parseChecklist(checklists[n]);
          return (
            <button key={n}
              className={'subtab' + (active===n?' active':'')}
              onClick={()=>setActive(n)}>
              {n}
              <span className="progress">{p.done}/{p.total}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 14px', borderBottom: '1px solid var(--border-1)', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{parsed.done} of {parsed.total} checked</span>
        <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: (parsed.done/Math.max(1,parsed.total)*100)+'%', height: '100%', background: 'var(--accent)' }}/>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{Math.round(parsed.done/Math.max(1,parsed.total)*100)}%</span>
      </div>
      <MarkdownView md={md} onToggleTask={handleToggle}/>
    </div>
  );
}

function ContractsView({ contracts, onUpdate, editing }) {
  const names = Object.keys(contracts);
  const [active, setActive] = uS2(names[0]);
  if (names.length === 0) {
    return (
      <div className="empty">
        <div className="glyph">§</div>
        <h3>No contracts</h3>
        <p>This feature has no <code style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>contracts/</code> folder.</p>
      </div>
    );
  }
  const md = contracts[active];
  return (
    <div>
      <div className="subtabs">
        {names.map(n => (
          <button key={n}
            className={'subtab' + (active===n?' active':'')}
            onClick={()=>setActive(n)}><Icon.contract style={{marginRight:6}}/>{n}</button>
        ))}
      </div>
      {editing
        ? <SplitEditor md={md} onChange={v => onUpdate(active, v)}/>
        : <MarkdownView md={md}/>
      }
    </div>
  );
}

function FeatureDetail({ feature, onUpdateArtifact, onUpdateChecklist, onUpdateContract, layout, initialTab }) {
  const [tabId, setTabId] = uS2('spec.md');
  const [editing, setEditing] = uS2(false);
  const [saved, setSaved] = uS2(false);

  // Reset tab when feature changes; honour initialTab when navigating from Compare
  uE2(() => {
    setTabId(initialTab || 'spec.md');
    setEditing(false);
  }, [feature.id]);

  const meta = featureMeta(feature);
  const title = featureTitle(feature);
  const tasksParsed = parseTasks(feature.artifacts['tasks.md']);
  const isComplete = tasksParsed.total > 0 && tasksParsed.done === tasksParsed.total;
  const isDraft = tasksParsed.total === 0;
  const checklistCount = Object.keys(feature.checklists).length;
  const contractCount = Object.keys(feature.contracts).length;

  // Tab definitions
  const tabs = [
    ...ARTIFACT_TABS.map(t => ({ ...t, present: !!feature.artifacts[t.id] })),
    { id: '__checklists', label: 'Checklists', icon: 'checklist', present: checklistCount > 0, count: checklistCount },
    { id: '__contracts',  label: 'Contracts',  icon: 'contract',  present: contractCount > 0,  count: contractCount },
  ];

  // PRD says: "Artifacts that don't exist for a feature are silently omitted."
  // So we hide tabs for missing artifacts (except the standard ones for completeness — we'll show them dimmed).
  // Decision: show all but mark missing as 'missing' (style only). The user sees the full taxonomy.

  const triggerSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  const handleArtifactChange = (v) => {
    onUpdateArtifact(feature.id, tabId, v);
    triggerSave();
  };

  const handleTaskCheckbox = (v) => {
    onUpdateArtifact(feature.id, 'tasks.md', v);
    triggerSave();
  };

  const handleInlineToggle = (idx) => {
    const updated = toggleTaskInMarkdown(feature.artifacts[tabId] || '', idx);
    onUpdateArtifact(feature.id, tabId, updated);
    triggerSave();
  };

  const handleChecklistChange = (name, v) => {
    onUpdateChecklist(feature.id, name, v);
    triggerSave();
  };

  const handleContractChange = (name, v) => {
    onUpdateContract(feature.id, name, v);
    triggerSave();
  };

  // Body content for active tab
  let body = null;
  let currentMd = '';
  const isArtifactTab = ARTIFACT_TABS.some(t => t.id === tabId);

  if (isArtifactTab) {
    currentMd = feature.artifacts[tabId] || '';
    if (!currentMd) {
      body = (
        <div className="empty">
          <div className="glyph">—</div>
          <h3>No {tabId} for this feature</h3>
          <p>The file doesn't exist on disk. Speckit will generate it when you run the corresponding command.</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => {
            onUpdateArtifact(feature.id, tabId, `# ${tabId.replace('.md','')}\n\n`);
            setEditing(true);
          }}>Create {tabId}</button>
        </div>
      );
    } else if (tabId === 'tasks.md' && !editing) {
      body = <TasksView md={currentMd} onUpdate={handleTaskCheckbox}/>;
    } else if (editing) {
      body = <SplitEditor md={currentMd} onChange={handleArtifactChange}/>;
    } else {
      body = <MarkdownView md={currentMd} onToggleTask={handleInlineToggle}/>;
    }
  } else if (tabId === '__checklists') {
    body = <ChecklistsView checklists={feature.checklists} onUpdate={handleChecklistChange}/>;
  } else if (tabId === '__contracts') {
    body = <ContractsView contracts={feature.contracts} onUpdate={handleContractChange} editing={editing}/>;
  }

  const outline = isArtifactTab && currentMd && !editing && tabId !== 'tasks.md' ? extractOutline(currentMd) : [];

  return (
    <div className="main" key={feature.id}>
      <div className="detail-head">
        <div className="detail-crumbs">
          <span>specs</span>
          <span className="sep">/</span>
          <span style={{ color: 'var(--text-1)' }}>{feature.id}</span>
        </div>
        <div className="detail-title">
          <h1>{title}</h1>
          <span className="feature-id">{feature.id}</span>
        </div>
        <div className="detail-meta">
          {meta.branch && <span className="branch">{meta.branch}</span>}
          {meta.created && <span>created {meta.created}</span>}
          <span className={'pill ' + (isComplete ? 'complete' : isDraft ? 'draft' : '')}>
            <span className="dot"/>
            {isComplete ? 'Complete' : isDraft ? 'Draft' : 'In progress'}
          </span>
          {tasksParsed.total > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {tasksParsed.done}/{tasksParsed.total} tasks
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div className="tabs">
            {tabs.map(t => {
              const Ic = Icon[t.icon];
              const dim = !t.present;
              const showCount = t.id === 'tasks.md' ? tasksParsed.total : t.count;
              return (
                <div key={t.id}
                  className={'tab' + (tabId===t.id?' active':'') + (dim?' missing':'')}
                  onClick={() => { if (t.present || tabId === t.id) { setTabId(t.id); setEditing(false); } }}
                  title={dim ? `${t.id} — not present in this feature` : t.label}>
                  <Ic/>
                  <span>{t.label}</span>
                  {!!showCount && <span className="tab-count">{showCount}</span>}
                </div>
              );
            })}
          </div>

          {isArtifactTab && currentMd && (
            <div style={{ display: 'flex', gap: 6, paddingBottom: 6 }}>
              {tabId === 'tasks.md' && !editing && (
                <button className="btn ghost" onClick={()=>setEditing(true)}>Edit raw</button>
              )}
              {tabId !== 'tasks.md' && (
                editing
                  ? <button className="btn primary" onClick={()=>setEditing(false)}><Icon.check/> Done</button>
                  : <button className="btn ghost" onClick={()=>setEditing(true)}><Icon.edit/> Edit</button>
              )}
            </div>
          )}
          {tabId === '__contracts' && Object.keys(feature.contracts).length > 0 && (
            <div style={{ display: 'flex', gap: 6, paddingBottom: 6 }}>
              {editing
                ? <button className="btn primary" onClick={()=>setEditing(false)}><Icon.check/> Done</button>
                : <button className="btn ghost" onClick={()=>setEditing(true)}><Icon.edit/> Edit</button>
              }
            </div>
          )}
        </div>
      </div>

      <div className={'content' + (editing && isArtifactTab && tabId !== 'tasks.md' ? ' layout-split' : '')}>
        {outline.length > 4 && (layout === 'split' || layout === 'with-rail') ? (
          <div className="detail-body">
            <div>{body}</div>
            <aside className="outline-rail">
              <div className="o-head">On this page</div>
              {outline.map((o, i) => (
                <a key={i} href={'#'+o.slug} className={'l'+o.level}>{o.text}</a>
              ))}
            </aside>
          </div>
        ) : body}
      </div>

      {saved && (
        <div className="save-toast">
          <span className="dot"/>
          <span>Saved to {feature.id}/{tabId.startsWith('__') ? tabId.slice(2) : tabId}</span>
        </div>
      )}
    </div>
  );
}

// All-features list view (denser than sidebar)
function FeatureListView({ features, onOpenFeature }) {
  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>All features</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{features.length} discovered</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border-1)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 110px 110px 80px 80px 200px', gap: 12, padding: '10px 14px', background: 'var(--bg-1)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
          <span>#</span>
          <span>Feature</span>
          <span>Status</span>
          <span>Tasks</span>
          <span>Checks</span>
          <span>Created</span>
          <span>Branch</span>
        </div>
        {features.map(f => {
          const t = parseTasks(f.artifacts['tasks.md']);
          const meta = featureMeta(f);
          let clT = 0, clD = 0;
          Object.values(f.checklists).forEach(c => { const p = parseChecklist(c); clT += p.total; clD += p.done; });
          const status = t.total === 0 ? 'draft' : t.done === t.total ? 'complete' : 'active';
          return (
            <div key={f.id}
              style={{ display: 'grid', gridTemplateColumns: '60px 1fr 110px 110px 80px 80px 200px', gap: 12, padding: '10px 14px', background: 'var(--bg-1)', alignItems: 'center', cursor: 'pointer', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-1)'}
              onClick={() => onOpenFeature(f.id)}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontSize: 11 }}>{f.id.split('-')[0]}</span>
              <span style={{ color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{featureTitle(f)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'complete' ? 'var(--success)' : status === 'active' ? 'var(--accent)' : 'var(--text-4)' }}/>
                <span style={{ color: status === 'complete' ? 'var(--success)' : status === 'active' ? 'var(--accent)' : 'var(--text-3)' }}>{status === 'complete' ? 'Complete' : status === 'active' ? 'In progress' : 'Draft'}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: 'var(--bg-3)', borderRadius: 2 }}>
                  <div style={{ width: (t.total ? t.done/t.total*100 : 0)+'%', height: '100%', background: 'var(--accent)' }}/>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>{t.total ? `${t.done}/${t.total}` : '—'}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: clT ? 'var(--text-2)' : 'var(--text-4)' }}>{clT ? `${clD}/${clT}` : '—'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{meta.created || '—'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.branch || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { FeatureDetail, FeatureListView, MarkdownView, SplitEditor, TasksView });
