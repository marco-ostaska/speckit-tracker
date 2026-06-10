// PRD list and detail views
const { useState: pS, useEffect: pE } = React;

function prdDisplayTitle(content, filename) {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].replace(/\*\*/g, '').replace(/`/g, '') : filename.replace(/\.md$/i, '');
}

function PrdListView({ prds, onOpenPrd }) {
  return (
    <div className="content">
      <div className="list-heading">
        <h1>PRDs</h1>
        <span>{prds.length} discovered · oldest first</span>
      </div>
      {prds.length === 0 ? (
        <div className="empty">
          <div className="glyph">—</div>
          <h3>No PRDs yet</h3>
          <p>Add Markdown files directly under <code>docs/prd/</code>.</p>
        </div>
      ) : (
        <div className="prd-list">
          {prds.map(prd => (
            <button key={prd.filename} className="prd-row" onClick={() => onOpenPrd(prd.filename)}>
              <span className="prd-icon"><Icon.contract/></span>
              <span className="prd-copy">
                <strong>{prd.title}</strong>
                <span>{prd.filename}</span>
              </span>
              <time>{new Date(prd.createdAt).toLocaleDateString()}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrdDetail({ prd, onUpdate }) {
  const [editing, setEditing] = pS(false);
  const [saved, setSaved] = pS(false);

  pE(() => {
    setEditing(false);
    setSaved(false);
  }, [prd.filename]);

  const handleChange = (content) => {
    onUpdate(prd.filename, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };
  const outline = !editing ? window.extractOutline(prd.content) : [];
  const body = editing
    ? <SplitEditor md={prd.content} onChange={handleChange}/>
    : <MarkdownView md={prd.content}/>;

  return (
    <div className="main prd-detail" key={prd.filename}>
      <div className="detail-head">
        <div className="detail-crumbs"><span>docs</span><span className="sep">/</span><span>prd</span><span className="sep">/</span><span style={{color:'var(--text-1)'}}>{prd.filename}</span></div>
        <div className="detail-title"><h1>{prd.title}</h1><span className="feature-id">{prd.filename}</span></div>
        <div className="detail-meta"><span>created {new Date(prd.createdAt).toLocaleDateString()}</span></div>
        <div className="detail-actions">
          <span className="detail-kind">Product requirements document</span>
          {editing
            ? <button className="btn primary" onClick={() => setEditing(false)}><Icon.check/> Done</button>
            : <button className="btn ghost" onClick={() => setEditing(true)}><Icon.edit/> Edit</button>}
        </div>
      </div>
      <div className={'content' + (editing ? ' layout-split' : '')}>
        {outline.length > 4 ? (
          <div className="detail-body">
            <div>{body}</div>
            <aside className="outline-rail">
              <div className="o-head">On this page</div>
              {outline.map((item, index) => <a key={index} href={'#' + item.slug} className={'l' + item.level}>{item.text}</a>)}
            </aside>
          </div>
        ) : body}
      </div>
      {saved && <div className="save-toast"><span className="dot"/><span>Saved to docs/prd/{prd.filename}</span></div>}
    </div>
  );
}

Object.assign(window, { prdDisplayTitle, PrdListView, PrdDetail });
