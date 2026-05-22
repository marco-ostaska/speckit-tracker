// Onboarding, Dashboard, Compare views
const { useState: uS, useMemo: uM } = React;

function Onboarding({ onOpen, onRemoveHistory, history = [], error = null }) {
  const [inputPath, setInputPath] = uS('');
  const [opening, setOpening] = uS(false);

  const handleOpen = (p) => {
    if (!p.trim() || opening) return;
    setOpening(true);
    onOpen(p.trim()).finally(() => setOpening(false));
  };

  const formatLastOpened = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins || 1}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="logo">S</div>
        <h1>Open a speckit project</h1>
        <div className="sub">Point Speckit Tracker at any directory that contains <code style={{fontFamily:'var(--font-mono)',color:'var(--accent)',fontSize:'12px'}}>specs/&lt;NNN&gt;-&lt;slug&gt;/</code> feature folders.</div>

        <div className="field-label">Project root</div>
        <div className="path-input">
          <input value={inputPath} onChange={e => setInputPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOpen(inputPath)}
            placeholder="/absolute/path  or  ~/relative/path"/>
        </div>
        {error && <div style={{color:'var(--red,#c0392b)',fontSize:12,marginTop:6}}>{error}</div>}

        {history.length > 0 && <>
          <div className="field-label">Recent projects</div>
          <div className="recent">
            {history.map(r => (
              <div key={r.root} className="recent-row" onClick={() => handleOpen(r.root)}>
                <Icon.folder/>
                <span>{r.root}</span>
                <span className="feats">{r.features} features · {formatLastOpened(r.lastOpened)}</span>
                <button
                  title="Remove from history"
                  onClick={e => { e.stopPropagation(); onRemoveHistory && onRemoveHistory(r.root); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px', borderRadius: 3 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red, #c0392b)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}
                >−</button>
              </div>
            ))}
          </div>
        </>}

        <div className="footer-row">
          <button className="btn primary" disabled={opening || !inputPath.trim()} onClick={() => handleOpen(inputPath)}>
            {opening ? 'Opening…' : 'Open project →'}
          </button>
          <span style={{color:'var(--text-3)',fontSize:'11px',fontFamily:'var(--font-mono)'}}>or run: node server.js /path</span>
        </div>
      </div>
    </div>
  );
}

function Donut({ slices, size = 88, stroke = 14 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke}/>
      {slices.map((sl, i) => {
        const len = (sl.value / total) * c;
        const dash = `${len} ${c - len}`;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r}
            fill="none" stroke={sl.color} strokeWidth={stroke}
            strokeDasharray={dash} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}/>
        );
        offset += len;
        return el;
      })}
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-1)" fontSize="18" fontWeight="600" fontFamily="var(--font-mono)">
        {Math.round((slices.find(s => s.label === 'done')?.value || 0) / total * 100)}%
      </text>
    </svg>
  );
}

function Heatmap({ tasks }) {
  // Each cell = one task. Order: by phase order.
  return (
    <div className="heatmap">
      {tasks.map((t, i) => (
        <span key={i}
          className={'cell ' + (t.done ? 'done' : 'draft')}
          title={`${t.id} ${t.desc}`}/>
      ))}
    </div>
  );
}

function Dashboard({ features, onOpenFeature, onView }) {
  const agg = uM(() => aggregateProgress(features), [features]);

  // Flatten tasks for global heatmap
  const allTasks = uM(() => {
    const arr = [];
    features.forEach(f => {
      const t = parseTasks(f.artifacts['tasks.md']);
      t.phases.forEach(p => p.tasks.forEach(tt => arr.push({ ...tt, feature: f.id })));
    });
    return arr;
  }, [features]);

  const activeFeatures = features.filter(f => {
    const t = parseTasks(f.artifacts['tasks.md']);
    return t.total > 0 && t.done < t.total;
  });

  const recentActivity = [
    { when: '2m ago',   who: 'me',   what: 'Marked T013 "Implement Execute() bulk group assignment" as done', feat: '002-kaif-bridge-access' },
    { when: '14m ago',  who: 'me',   what: 'Edited spec.md — added clarification on rate-limiting',          feat: '003-fix-getbyemail-n1' },
    { when: '1h ago',   who: 'me',   what: 'Updated checklist requirements.md — 3 items checked',           feat: '004-kaif-audit-user-details' },
    { when: '3h ago',   who: 'me',   what: 'Added quickstart.md',                                            feat: '004-kaif-audit-user-details' },
    { when: 'yesterday',who: 'me',   what: 'Completed Phase 5 — User Story 3 promotion readiness',          feat: '001-kaif-bulk-enable' },
    { when: '2d ago',   who: 'me',   what: 'Drafted spec.md (template state — not started)',                feat: '001-kaif-bridge-access' },
  ];

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Dashboard</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
          {features.length} features · {agg.totalT} tasks · {agg.totalCl} checklist items
        </span>
      </div>

      <div className="dash-grid">
        {/* KPIs */}
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <h3>Task completion</h3>
          <div className="kpi"><span className="v">{agg.totalT ? Math.round(agg.doneT / agg.totalT * 100) : 0}<span style={{fontSize:18,color:'var(--text-3)'}}>%</span></span><span className="d">{agg.doneT} / {agg.totalT}</span></div>
          <div className="fr-progress" style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2 }}>
            <div style={{ width: (agg.doneT / Math.max(1, agg.totalT) * 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }}/>
          </div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <h3>Active features</h3>
          <div className="kpi"><span className="v">{activeFeatures.length}</span><span className="d">of {features.length}</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {features.map(f => {
              const t = parseTasks(f.artifacts['tasks.md']);
              const cls = t.total === 0 ? 'draft' : (t.done === t.total ? 'complete' : 'active');
              return <span key={f.id} title={f.id} style={{
                width: 18, height: 18, borderRadius: 3, fontSize: 9,
                fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: cls === 'complete' ? 'var(--success)' : cls === 'active' ? 'var(--accent)' : 'var(--bg-3)',
                color: cls === 'draft' ? 'var(--text-3)' : 'white', cursor: 'pointer',
              }} onClick={() => onOpenFeature(f.id)}>{f.id.split('-')[0]}</span>;
            })}
          </div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <h3>Open checklist items</h3>
          <div className="kpi warn"><span className="v">{agg.totalCl - agg.doneCl}</span><span className="d">of {agg.totalCl} total</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Across {features.filter(f => Object.keys(f.checklists).length).length} features with checklists.</div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <h3>Branches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            {features.map(f => {
              const m = featureMeta(f);
              return <div key={f.id} style={{ display: 'flex', gap: 6, color: 'var(--text-2)' }}>
                <span style={{color:'var(--text-4)'}}>{f.id.split('-')[0]}</span>
                <span style={{color:'var(--accent)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.branch || '—'}</span>
              </div>;
            })}
          </div>
        </div>

        {/* Heatmap */}
        <div className="card" style={{ gridColumn: 'span 8' }}>
          <h3>Task heatmap — every cell is one task</h3>
          <Heatmap tasks={allTasks}/>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
            <span><span className="cell" style={{display:'inline-block',width:10,height:10,background:'var(--accent)',borderRadius:2,marginRight:5,verticalAlign:'middle'}}/>Done</span>
            <span><span className="cell" style={{display:'inline-block',width:10,height:10,background:'var(--bg-3)',border:'1px solid var(--border-1)',borderRadius:2,marginRight:5,verticalAlign:'middle'}}/>Pending</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{agg.doneT} / {agg.totalT}</span>
          </div>
        </div>

        {/* Per-feature donuts */}
        <div className="card" style={{ gridColumn: 'span 4' }}>
          <h3>Progress by feature</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map(f => {
              const t = parseTasks(f.artifacts['tasks.md']);
              const ratio = t.total ? t.done / t.total : 0;
              return (
                <div key={f.id} onClick={() => onOpenFeature(f.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{f.id.split('-')[0]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)', flex: 1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{featureTitle(f)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>{t.total ? `${Math.round(ratio*100)}%` : 'draft'}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: (ratio*100)+'%', height: '100%', background: t.total && t.done === t.total ? 'var(--success)' : 'var(--accent)' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity */}
        <div className="card" style={{ gridColumn: 'span 8' }}>
          <h3>Recent activity</h3>
          <div className="activity-list">
            {recentActivity.map((a, i) => (
              <div key={i} className="row" onClick={() => onOpenFeature(a.feat)} style={{cursor:'pointer'}}>
                <span className="when">{a.when}</span>
                <span className="who">{a.who}</span>
                <span className="what">{a.what}</span>
                <span className="feat">{a.feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Constitution / Risks summary */}
        <div className="card" style={{ gridColumn: 'span 4' }}>
          <h3>Constitution gates</h3>
          {[
            ['I.   Branch discipline', 'pass'],
            ['II.  Audit completeness', 'pass'],
            ['III. Observable batch', 'pass'],
            ['IV.  Feature flag gating', 'pass'],
            ['V.   Test coverage', 'warn'],
            ['VI.  Test-first dev', 'pass'],
            ['VII. Simplicity / YAGNI', 'pass'],
            ['VIII.Pre-change diligence', 'pass'],
          ].map(([name, status]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, padding: '3px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'pass' ? 'var(--success)' : status === 'warn' ? 'var(--warning)' : 'var(--danger)', flexShrink: 0 }}/>
              <span style={{ color: 'var(--text-2)', flex: 1 }}>{name}</span>
              <span style={{ color: status === 'pass' ? 'var(--success)' : 'var(--warning)' }}>{status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareView({ features, onOpenFeature }) {
  const [selected, setSelected] = uS(features.filter(f => parseTasks(f.artifacts['tasks.md']).total > 0).slice(0, 3).map(f => f.id));

  const toggle = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const selectedFeatures = features.filter(f => selected.includes(f.id));

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Compare features</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
          {selected.length} selected
        </span>
      </div>
      <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 14 }}>
        Select features to compare progress, structure and risk side-by-side.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {features.map(f => (
          <button key={f.id}
            className={'filter-pill' + (selected.includes(f.id) ? ' active' : '')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 10px', borderRadius: 5,
                     background: selected.includes(f.id) ? 'var(--accent-soft)' : 'var(--bg-1)',
                     color: selected.includes(f.id) ? 'var(--accent)' : 'var(--text-2)',
                     border: '1px solid ' + (selected.includes(f.id) ? 'var(--accent-line)' : 'var(--border-1)'),
                     cursor: 'pointer' }}
            onClick={() => toggle(f.id)}>
            {f.id}
          </button>
        ))}
      </div>

      <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, selectedFeatures.length)}, minmax(280px, 1fr))` }}>
        {selectedFeatures.map(f => {
          const t = parseTasks(f.artifacts['tasks.md']);
          const meta = featureMeta(f);
          const allTaskList = [];
          t.phases.forEach(p => p.tasks.forEach(tt => allTaskList.push(tt)));
          const stories = Object.entries(t.byStory);
          const artifactPresence = ['spec.md','plan.md','tasks.md','data-model.md','research.md','quickstart.md']
            .map(a => ({ name: a, present: !!f.artifacts[a] }));
          const checklistCount = Object.keys(f.checklists).length;
          const contractCount = Object.keys(f.contracts).length;

          return (
            <div key={f.id} className="compare-col">
              <div className="head">
                <h3>{featureTitle(f)}</h3>
                <div className="meta">{f.id} · {meta.branch || '—'}</div>
              </div>
              <div className="body">
                <div className="stat-row"><span className="lbl">Status</span><span className="val" style={{color: t.total===0?'var(--warning)':t.done===t.total?'var(--success)':'var(--accent)'}}>{t.total === 0 ? 'Draft (no tasks)' : t.done === t.total ? 'Complete' : 'In progress'}</span></div>
                <div className="stat-row"><span className="lbl">Created</span><span className="val">{meta.created || '—'}</span></div>
                <div className="stat-row"><span className="lbl">Phases</span><span className="val">{t.phases.length}</span></div>
                <div className="stat-row"><span className="lbl">Tasks</span><span className="val">{t.done}/{t.total}</span></div>
                <div className="stat-row"><span className="lbl">Checklists</span><span className="val" style={{cursor:checklistCount>0?'pointer':'default',color:checklistCount>0?'var(--accent)':'inherit'}} onClick={()=>checklistCount>0&&onOpenFeature(f.id,'__checklists')}>{checklistCount}</span></div>
                <div className="stat-row"><span className="lbl">Contracts</span><span className="val" style={{cursor:contractCount>0?'pointer':'default',color:contractCount>0?'var(--accent)':'inherit'}} onClick={()=>contractCount>0&&onOpenFeature(f.id,'__contracts')}>{contractCount}</span></div>

                {t.total > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Task heatmap</div>
                    <Heatmap tasks={allTaskList}/>
                  </div>
                )}

                {stories.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>By user story</div>
                    {stories.map(([story, v]) => (
                      <div key={story} style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize: 10, color:'var(--accent)', background:'var(--accent-soft)', padding:'1px 5px', borderRadius:3, minWidth: 40, textAlign:'center' }}>{story}</span>
                        <div style={{ flex: 1, height: 3, background: 'var(--bg-3)', borderRadius: 2 }}>
                          <div style={{ width: (v.done/v.total*100)+'%', height: '100%', background: 'var(--accent)' }}/>
                        </div>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize: 10.5, color:'var(--text-3)' }}>{v.done}/{v.total}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Artifacts</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
                    {artifactPresence.map(a => (
                      <span key={a.name}
                        onClick={() => a.present && onOpenFeature(f.id, a.name)}
                        title={a.present ? `Open ${a.name}` : `${a.name} not present`}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          padding: '2px 6px', borderRadius: 3,
                          background: a.present ? 'var(--accent-soft)' : 'var(--bg-2)',
                          color: a.present ? 'var(--accent)' : 'var(--text-4)',
                          border: '1px solid ' + (a.present ? 'var(--accent-line)' : 'var(--border-1)'),
                          cursor: a.present ? 'pointer' : 'default',
                        }}>{a.name.replace('.md','')}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, Dashboard, CompareView, Donut, Heatmap });
