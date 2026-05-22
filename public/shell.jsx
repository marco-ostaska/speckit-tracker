// Generic UI bits: Sidebar, Titlebar, helpers
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// --- Iconography (lightweight stroke icons) ---
const Icon = {
  spec: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><rect x="2.5" y="1.5" width="9" height="11" rx="1.5"/><path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3"/></svg>,
  plan: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M2 7l2.5-2.5L7 7l4.5-4.5"/><path d="M11.5 2.5h-2M11.5 2.5v2"/></svg>,
  tasks: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><rect x="1.5" y="2.5" width="3" height="3" rx="0.5"/><rect x="1.5" y="8.5" width="3" height="3" rx="0.5"/><path d="M6.5 4h6M6.5 10h6"/></svg>,
  data: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><ellipse cx="7" cy="3.5" rx="4.5" ry="1.5"/><path d="M2.5 3.5v7c0 0.8 2 1.5 4.5 1.5s4.5-0.7 4.5-1.5v-7"/><path d="M2.5 7c0 0.8 2 1.5 4.5 1.5s4.5-0.7 4.5-1.5"/></svg>,
  research: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>,
  quickstart: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M7 1.5l5 4-5 4v-2.5c-3 0-5 1.5-5 4 0-3 2-6 5-6V1.5z"/></svg>,
  checklist: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M3 4l1 1 2-2M3 9l1 1 2-2"/><path d="M8 4h4M8 9h4"/></svg>,
  contract: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M3.5 1.5h5l3 3v8H3.5z"/><path d="M8.5 1.5v3h3"/><path d="M5 7.5h4M5 9.5h4"/></svg>,
  dashboard: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><rect x="1.5" y="1.5" width="5" height="5" rx="0.8"/><rect x="7.5" y="1.5" width="5" height="3" rx="0.8"/><rect x="7.5" y="5.5" width="5" height="7" rx="0.8"/><rect x="1.5" y="7.5" width="5" height="5" rx="0.8"/></svg>,
  compare: (p) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M3.5 1.5v11M10.5 1.5v11"/><path d="M2 4.5l1.5-1.5 1.5 1.5M9 9.5l1.5 1.5 1.5-1.5"/></svg>,
  edit: (p) => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M2 11l8.5-8.5 1.5 1.5L3.5 12.5H2z"/><path d="M9 3l2 2"/></svg>,
  check: (p) => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M2.5 6.5l2.5 2.5L9.5 3.5"/></svg>,
  folder: (p) => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M1.5 3.5h4l1.5 1.5h5.5v7h-11z"/></svg>,
  search: (p) => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>,
  refresh: (p) => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M2 7a5 5 0 019-3M12 7a5 5 0 01-9 3"/><path d="M11 1.5v3h-3M3 12.5v-3h3"/></svg>,
};

function Titlebar({ projectPath, onRoot, dark, onToggleTheme }) {
  return (
    <div className="titlebar">
      <div className="tb-traffic">
        <span className="tb-dot red"></span>
        <span className="tb-dot yellow"></span>
        <span className="tb-dot green"></span>
      </div>
      <div className="tb-project">
        <Icon.folder/>
        <span className="root-path">{projectPath}</span>
        <span className="tb-badge">speckit</span>
      </div>
      <div className="tb-spacer"></div>
      <button className="tb-action" onClick={onToggleTheme}>{dark ? '☾' : '☀'}</button>
      <button className="tb-action" onClick={onRoot}>change project</button>
      <button className="tb-action"><Icon.refresh/></button>
    </div>
  );
}

function Sidebar({ features, view, currentId, onSelect, onView }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icon.dashboard/>, kbd: '⌘1' },
    { id: 'features', label: 'All features', icon: <Icon.spec/>, kbd: '⌘2' },
    { id: 'compare', label: 'Compare', icon: <Icon.compare/>, kbd: '⌘3' },
  ];

  return (
    <aside className="sidebar">
      <div className="side-section">Workspace</div>
      <nav className="side-nav">
        {navItems.map(n => (
          <div key={n.id}
            className={'side-item' + (view === n.id ? ' active' : '')}
            onClick={() => onView(n.id)}>
            <span className="icon">{n.icon}</span>
            <span>{n.label}</span>
            <span className="kbd">{n.kbd}</span>
          </div>
        ))}
      </nav>

      <div className="side-section">
        <span>Features</span>
        <span className="count">{features.length}</span>
      </div>
      <div className="feature-list">
        {features.map(f => {
          const t = parseTasks(f.artifacts['tasks.md']);
          const ratio = t.total ? t.done / t.total : 0;
          const draft = t.total === 0;
          const complete = t.total > 0 && t.done === t.total;
          return (
            <div key={f.id}
              className={'feature-row' +
                (currentId === f.id && view === 'feature' ? ' active' : '') +
                (draft ? ' draft' : complete ? ' complete' : '')}
              onClick={() => { onSelect(f.id); }}>
              <div className="fr-top">
                <span className="fr-num">{f.id.split('-')[0]}</span>
                <span className="fr-name">{featureTitle(f).replace(/^Feature Specification:\s*/, '')}</span>
              </div>
              <div className="fr-bottom">
                <div className="fr-progress"><div className="bar" style={{ width: (ratio * 100) + '%' }}/></div>
                <span className="fr-ratio">{draft ? 'draft' : `${t.done}/${t.total}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

window.Titlebar = Titlebar;
window.Sidebar = Sidebar;
window.Icon = Icon;
