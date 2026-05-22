// Main app — orchestrates routing, state, tweaks
const { useState: aS, useEffect: aE, useMemo: aM, useRef: aR, useCallback: aC } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#8b93e8",
  "density": "regular",
  "bodyFont": "sans",
  "layoutWithRail": true
}/*EDITMODE-END*/;

const ACCENT_PALETTE = [
  '#8b93e8',
  '#7aa8d6',
  '#6db59a',
  '#c89868',
  '#c47b8a',
  '#a0a4ad',
];

function persist(featId, relPath, content) {
  return fetch(`/api/features/${encodeURIComponent(featId)}/write`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relPath, content }),
  }).then(r => {
    if (!r.ok) return r.json().then(b => { throw new Error(b.error || r.statusText); });
  });
}

// Per-feature debounce: each featId gets its own timer so switching features
// never cancels a pending save for a different feature.
function usePersistDebounced(delay = 600) {
  const timers = aR({});
  return aC((featId, relPath, content, onError) => {
    clearTimeout(timers.current[featId]);
    timers.current[featId] = setTimeout(() => {
      persist(featId, relPath, content).catch(onError);
    }, delay);
  }, [delay]);
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [opened, setOpened] = aS(false);
  const [projectRoot, setProjectRoot] = aS('');
  const [features, setFeatures] = aS([]);
  const [history, setHistory] = aS([]);
  const [openError, setOpenError] = aS(null);
  const [writeError, setWriteError] = aS(null);
  const [view, setView] = aS('dashboard');
  const [currentId, setCurrentId] = aS(null);
  const [pendingTab, setPendingTab] = aS(null);
  const persistDebounced = usePersistDebounced(600);

  const showWriteError = (err) => {
    setWriteError(err.message || 'Save failed');
    setTimeout(() => setWriteError(null), 3000);
  };

  // On startup: check if server already has a project open (e.g. passed via CLI arg)
  // and load history for the onboarding screen.
  aE(() => {
    Promise.all([
      fetch('/api/state').then(r => r.json()),
      fetch('/api/history').then(r => r.json()),
    ]).then(([state, hist]) => {
      setHistory(hist);
      if (state.root) {
        return fetch('/api/features')
          .then(r => {
            if (!r.ok) return r.json().then(b => { throw new Error(b.error || r.statusText); });
            return r.json();
          })
          .then(({ root, features: data }) => {
            setProjectRoot(root);
            setFeatures(data);
            setCurrentId(data[1]?.id || data[0]?.id);
            setOpened(true);
          });
      }
    }).catch(err => console.error('Startup error:', err));
  }, []);

  // Apply tweaks to document
  aE(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    document.documentElement.style.setProperty('--accent-soft', tweaks.accent + '22');
    document.documentElement.style.setProperty('--accent-line', tweaks.accent + '55');
    if (tweaks.bodyFont === 'mono') {
      document.documentElement.style.setProperty('--font-body', 'var(--font-mono)');
    } else if (tweaks.bodyFont === 'serif') {
      document.documentElement.style.setProperty('--font-body', 'var(--font-serif)');
    } else {
      document.documentElement.style.setProperty('--font-body', 'var(--font-sans)');
    }
  }, [tweaks]);

  // Opens a project by path — calls server, sets state on success
  const handleOpen = (rootPath) => {
    setOpenError(null);
    return fetch('/api/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: rootPath }),
    })
      .then(r => r.json().then(b => ({ ok: r.ok, body: b })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error);
        setProjectRoot(body.root);
        setFeatures(body.features);
        setCurrentId(body.features[1]?.id || body.features[0]?.id);
        setHistory(h => {
          const filtered = h.filter(e => e.root !== body.root);
          return [{ root: body.root, features: body.features.length, lastOpened: new Date().toISOString() }, ...filtered].slice(0, 8);
        });
        setView('dashboard');
        setOpened(true);
      })
      .catch(err => { setOpenError(err.message); });
  };

  const handleSelectFeature = (id, tabId = null) => {
    setCurrentId(id);
    setPendingTab(tabId);
    setView('feature');
  };

  const handleReload = () => {
    if (!projectRoot) return;
    fetch('/api/features')
      .then(r => r.json())
      .then(({ features: data }) => setFeatures(data))
      .catch(err => console.error('Reload error:', err));
  };

  const handleUpdateArtifact = (featId, artifact, content) => {
    setFeatures(fs => fs.map(f => f.id === featId
      ? { ...f, artifacts: { ...f.artifacts, [artifact]: content } }
      : f
    ));
    persistDebounced(featId, artifact, content, showWriteError);
  };

  const handleUpdateChecklist = (featId, name, content) => {
    setFeatures(fs => fs.map(f => f.id === featId
      ? { ...f, checklists: { ...f.checklists, [name]: content } }
      : f
    ));
    persist(featId, `checklists/${name}`, content).catch(showWriteError);
  };

  const handleUpdateContract = (featId, name, content) => {
    setFeatures(fs => fs.map(f => f.id === featId
      ? { ...f, contracts: { ...f.contracts, [name]: content } }
      : f
    ));
    persistDebounced(featId, `contracts/${name}`, content, showWriteError);
  };

  if (!opened) {
    return (
      <Onboarding
        onOpen={handleOpen}
        history={history}
        error={openError}
      />
    );
  }

  const current = features.find(f => f.id === currentId);

  return (
    <div className="app">
      <Titlebar
        projectPath={projectRoot}
        onRoot={() => setOpened(false)}
        dark={tweaks.theme === 'dark'}
        onToggleTheme={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')}
        onReload={handleReload}
      />
      <div className="shell">
        <Sidebar
          features={features}
          view={view}
          currentId={currentId}
          onSelect={handleSelectFeature}
          onView={setView}
        />
        {view === 'dashboard' && <Dashboard features={features} onOpenFeature={handleSelectFeature} onView={setView}/>}
        {view === 'features' && <FeatureListView features={features} onOpenFeature={handleSelectFeature}/>}
        {view === 'compare' && <CompareView features={features} onOpenFeature={handleSelectFeature}/>}
        {view === 'feature' && current && (
          <FeatureDetail
            feature={current}
            layout={tweaks.layoutWithRail ? 'with-rail' : 'plain'}
            onUpdateArtifact={handleUpdateArtifact}
            onUpdateChecklist={handleUpdateChecklist}
            onUpdateContract={handleUpdateContract}
            initialTab={pendingTab}
          />
        )}
      </div>

      {writeError && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--red,#c0392b)', color: '#fff', padding: '8px 16px', borderRadius: 6, fontSize: 13, zIndex: 9999 }}>
          Save failed: {writeError}
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance">
          <TweakRadio label="Theme" value={tweaks.theme} onChange={v => setTweak('theme', v)}
            options={[{value:'dark',label:'Dark'},{value:'light',label:'Light'}]}/>
          <TweakColor label="Accent" value={tweaks.accent} onChange={v => setTweak('accent', v)} options={ACCENT_PALETTE}/>
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio label="Density" value={tweaks.density} onChange={v => setTweak('density', v)}
            options={[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'comfortable',label:'Roomy'}]}/>
          <TweakRadio label="Body font" value={tweaks.bodyFont} onChange={v => setTweak('bodyFont', v)}
            options={[{value:'sans',label:'Sans'},{value:'serif',label:'Serif'},{value:'mono',label:'Mono'}]}/>
          <TweakToggle label="Outline rail" value={tweaks.layoutWithRail} onChange={v => setTweak('layoutWithRail', v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
