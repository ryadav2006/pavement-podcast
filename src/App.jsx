import { useState, useEffect } from 'react'

const WEB_SOURCES = [
  {name:"TechCrunch AI",   url:"techcrunch.com/tag/artificial-intelligence", type:"news",      badge:"free",    on:true},
  {name:"MIT Tech Review", url:"technologyreview.com",                       type:"magazine",  badge:"free",    on:true},
  {name:"The Verge",       url:"theverge.com",                               type:"news",      badge:"free",    on:true},
  {name:"OpenAI News",     url:"openai.com/news",                            type:"blog",      badge:"free",    on:true},
  {name:"Anthropic News",  url:"anthropic.com/news",                         type:"blog",      badge:"free",    on:true},
  {name:"Google Gemini",   url:"blog.google/products-and-platforms/gemini",  type:"blog",      badge:"free",    on:true},
  {name:"Axios Pro Rata",  url:"axios.com/pro/media-deals",                  type:"news",      badge:"partial", on:true},
  {name:"Ben Evans",       url:"ben-evans.com",                              type:"blog",      badge:"free",    on:true},
  {name:"Platformer",      url:"platformer.news",                            type:"newsletter",badge:"partial", on:false},
  {name:"Ars Technica",    url:"arstechnica.com",                            type:"tech",      badge:"free",    on:false},
]

const GMAIL_SOURCES = [
  {name:"NYT Morning Briefing", url:"nytimes.com",        type:"newsletter", badge:"gmail", on:true},
  {name:"Morning Brew",         url:"morningbrew.com",    type:"newsletter", badge:"gmail", on:true},
  {name:"TLDR Newsletter",      url:"tldr.tech",          type:"newsletter", badge:"gmail", on:true},
  {name:"The Rundown AI",       url:"therundown.ai",      type:"newsletter", badge:"gmail", on:true},
  {name:"Superhuman AI",        url:"superhumanai.com",   type:"newsletter", badge:"gmail", on:true},
  {name:"Axios AI+",            url:"axios.com",          type:"newsletter", badge:"gmail", on:true},
  {name:"Last Week in AI",      url:"lastweekin.ai",      type:"newsletter", badge:"gmail", on:true},
  {name:"The AI Report",        url:"theaireport.com",    type:"newsletter", badge:"gmail", on:true},
  {name:"a16z Newsletter",      url:"a16z.com",           type:"newsletter", badge:"gmail", on:true},
  {name:"The Diff",             url:"diff.substack.com",  type:"newsletter", badge:"gmail", on:false},
]

const SAMPLE_ARCHIVES = [
  {date:"3/13/26", title:"EP 072 · Daily Brief — 3/13/26", brief:"OpenAI's latest model update quietly outperformed expectations on reasoning benchmarks...", sources:8},
  {date:"3/12/26", title:"EP 071 · Daily Brief — 3/12/26", brief:"The a16z AI report dropped and the headline is enterprise adoption acceleration...", sources:11},
  {date:"3/11/26", title:"EP 070 · Daily Brief — 3/11/26", brief:"Anthropic's constitutional AI paper got a quiet update and the research community noticed...", sources:9},
  {date:"3/10/26", title:"EP 069 · Daily Brief — 3/10/26", brief:"Three AI acquisitions closed in 48 hours — all sub-$500M, all infrastructure plays...", sources:7},
]

const BADGE_CLASS = {free:"badge-free", partial:"badge-partial", gmail:"badge-gmail"}
const BADGE_LABEL = {free:"free", partial:"partial", gmail:"gmail"}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0f0f0f;--surface:#181818;--surface2:#212121;--border:rgba(255,255,255,0.07);
  --border2:rgba(255,255,255,0.14);--accent:#e8c84a;--accent-dim:rgba(232,200,74,0.1);
  --text:#f0ede6;--muted:rgba(240,237,230,0.42);--green:#5cb85c;--red:#e05b4b;--blue:#6495ed;
  --mono:'DM Mono',monospace;--serif:'Playfair Display',serif;--sans:'DM Sans',sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);margin:0;}
header{padding:1rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--bg);z-index:100;}
.logo-mark{width:32px;height:32px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-name{font-family:var(--serif);font-size:1.1rem;}
.logo-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.14em;text-transform:uppercase;}
.header-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.ep-chip{font-family:var(--mono);font-size:0.68rem;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:99px;padding:4px 12px;}
.btn-archive{background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-family:var(--mono);font-size:0.68rem;padding:6px 12px;cursor:pointer;transition:all 0.15s;letter-spacing:0.04em;}
.btn-archive:hover{border-color:var(--accent);color:var(--accent);}
.layout{display:grid;grid-template-columns:300px 1fr;min-height:calc(100vh - 65px);}
.sidebar{border-right:1px solid var(--border);display:flex;flex-direction:column;}
.tab-bar{display:flex;border-bottom:1px solid var(--border);}
.tab{flex:1;padding:0.6rem 0;font-family:var(--mono);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);text-align:center;cursor:pointer;border-bottom:2px solid transparent;transition:color 0.15s,border-color 0.15s;}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);}
.tab-panel{display:none;flex:1;overflow-y:auto;padding:1rem;flex-direction:column;gap:8px;}
.tab-panel.active{display:flex;}
.source-row{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;transition:border-color 0.15s;}
.source-row:hover{border-color:var(--border2);}
.source-row.on{border-color:rgba(232,200,74,0.3);background:var(--accent-dim);}
.src-icon{width:24px;height:24px;border-radius:5px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:0.65rem;color:var(--muted);flex-shrink:0;}
.src-info{flex:1;min-width:0;}
.src-name{font-size:0.8rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px;}
.src-meta{font-family:var(--mono);font-size:0.58rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.toggle{width:30px;height:17px;border-radius:99px;background:var(--surface2);border:1px solid var(--border2);cursor:pointer;position:relative;flex-shrink:0;transition:background 0.15s,border-color 0.15s;}
.toggle.on{background:var(--accent);border-color:var(--accent);}
.toggle::after{content:'';position:absolute;width:11px;height:11px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.15s;}
.toggle.on::after{left:15px;}
.badge{font-family:var(--mono);font-size:0.52rem;padding:1px 5px;border-radius:99px;flex-shrink:0;}
.badge-free{background:rgba(92,184,92,0.12);color:#5cb85c;}
.badge-partial{background:rgba(232,200,74,0.12);color:#e8c84a;}
.badge-gmail{background:rgba(100,149,237,0.12);color:#6495ed;}
.field-label{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px;}
.text-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:0.72rem;color:var(--text);outline:none;transition:border-color 0.15s;resize:none;}
.text-input:focus{border-color:var(--accent);}
.text-input::placeholder{color:var(--muted);}
.btn-small{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:0.68rem;padding:6px 12px;cursor:pointer;transition:border-color 0.15s,color 0.15s;width:100%;margin-top:6px;letter-spacing:0.05em;}
.btn-small:hover{border-color:var(--accent);color:var(--accent);}
.hint{font-family:var(--mono);font-size:0.6rem;color:var(--muted);line-height:1.6;margin-top:6px;}
.gmail-connect{margin:8px 0;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.gmail-status{font-family:var(--mono);font-size:0.68rem;display:flex;align-items:center;gap:6px;}
.gmail-status.connected{color:var(--green);}
.gmail-status.disconnected{color:var(--muted);}
.btn-gmail{background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:0.68rem;padding:7px 12px;cursor:pointer;transition:all 0.15s;letter-spacing:0.05em;text-align:center;}
.btn-gmail:hover{border-color:var(--blue);color:var(--blue);}
.btn-gmail.connected{border-color:rgba(92,184,92,0.3);color:var(--green);}
.tone-row{padding:1rem;border-top:1px solid var(--border);margin-top:auto;}
.tone-select{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--sans);font-size:0.8rem;color:var(--text);outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-color:var(--surface);padding-right:28px;}
.tone-select option{background:#1e1e1e;}
.main{display:flex;flex-direction:column;}
.hero{padding:2.5rem 2rem 1.5rem;text-align:center;border-bottom:1px solid var(--border);}
.hero-label{font-family:var(--mono);font-size:0.62rem;color:var(--muted);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:6px;}
.hero-title{font-family:var(--serif);font-size:1.8rem;margin-bottom:4px;}
.hero-date{font-family:var(--mono);font-size:0.7rem;color:var(--muted);margin-bottom:1.5rem;}
.btn-generate{background:var(--accent);color:#0f0f0f;border:none;border-radius:99px;padding:0.8rem 2.2rem;font-family:var(--serif);font-size:1rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:transform 0.12s;letter-spacing:-0.01em;}
.btn-generate:hover{transform:scale(1.03);}
.btn-generate:active{transform:scale(0.97);}
.btn-generate:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
.source-summary{font-family:var(--mono);font-size:0.68rem;color:var(--muted);margin-top:1rem;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.src-pill{background:var(--surface);border:1px solid var(--border);border-radius:99px;padding:3px 10px;}
.src-pill span{color:var(--accent);}
.output-area{padding:1.5rem 2rem;display:flex;flex-direction:column;gap:1rem;flex:1;}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;}
.panel-header{padding:0.65rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}
.panel-title{font-family:var(--mono);font-size:0.65rem;color:var(--muted);letter-spacing:0.12em;text-transform:uppercase;flex:1;}
.panel-badge{font-family:var(--mono);font-size:0.65rem;background:var(--accent-dim);color:var(--accent);padding:2px 8px;border-radius:99px;}
.panel-body{padding:1.25rem;min-height:120px;font-size:0.88rem;line-height:1.8;color:var(--text);}
.panel-body.empty{color:var(--muted);font-style:italic;}
.export-row{display:flex;gap:8px;align-items:center;padding:1rem 2rem;border-top:1px solid var(--border);flex-wrap:wrap;}
.export-label{font-family:var(--mono);font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-right:4px;}
.btn-export{background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-family:var(--mono);font-size:0.68rem;padding:6px 14px;cursor:pointer;transition:all 0.15s;letter-spacing:0.04em;}
.btn-export:hover{border-color:var(--accent);color:var(--accent);}
.btn-export:disabled{opacity:0.3;cursor:not-allowed;}
.btn-export.primary{border-color:rgba(232,200,74,0.4);color:var(--accent);}
.btn-export.primary:hover{background:var(--accent-dim);}
.error-bar{background:rgba(224,91,75,0.1);border:1px solid rgba(224,91,75,0.3);border-radius:8px;padding:0.75rem 1rem;font-family:var(--mono);font-size:0.75rem;color:var(--red);margin:0 2rem;}
.success-bar{background:rgba(92,184,92,0.1);border:1px solid rgba(92,184,92,0.3);border-radius:8px;padding:0.75rem 1rem;font-family:var(--mono);font-size:0.75rem;color:var(--green);margin:0 2rem;}
.adhoc-item{background:var(--surface);border:1px solid rgba(232,200,74,0.2);border-radius:8px;padding:7px 10px;display:flex;align-items:center;gap:8px;}
.remove-btn{font-family:var(--mono);font-size:0.65rem;color:var(--red);cursor:pointer;padding:2px 4px;flex-shrink:0;opacity:0.7;}
.remove-btn:hover{opacity:1;}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;opacity:0;transition:opacity 0.2s;pointer-events:none;}
.drawer-overlay.open{opacity:1;pointer-events:all;}
.drawer{position:fixed;right:0;top:0;bottom:0;width:420px;background:var(--surface);border-left:1px solid var(--border);z-index:201;transform:translateX(100%);transition:transform 0.25s ease;display:flex;flex-direction:column;}
.drawer.open{transform:translateX(0);}
.drawer-header{padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.drawer-title{font-family:var(--serif);font-size:1.1rem;}
.drawer-close{background:transparent;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;padding:4px;}
.drawer-close:hover{color:var(--text);}
.drawer-body{flex:1;overflow-y:auto;padding:1rem 1.5rem;display:flex;flex-direction:column;gap:10px;}
.archive-item{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:1rem;cursor:pointer;transition:border-color 0.15s;}
.archive-item:hover{border-color:var(--accent);}
.archive-date{font-family:var(--mono);font-size:0.62rem;color:var(--accent);margin-bottom:4px;}
.archive-title{font-size:0.85rem;font-weight:500;margin-bottom:6px;}
.archive-preview{font-size:0.78rem;color:var(--muted);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.archive-meta{font-family:var(--mono);font-size:0.6rem;color:var(--muted);margin-top:8px;}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(15,15,15,0.3);border-top-color:#0f0f0f;border-radius:50%;animation:spin 0.7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`

export default function App() {
  const [webSources, setWebSources] = useState(WEB_SOURCES.map(s => ({...s})))
  const [gmailSources, setGmailSources] = useState(GMAIL_SOURCES.map(s => ({...s})))
  const [adhocItems, setAdhocItems] = useState([])
  const [activeTab, setActiveTab] = useState('web')
  const [tone, setTone] = useState('sharp and opinionated')
  const [brief, setBrief] = useState('')
  const [notebooklm, setNotebooklm] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archives, setArchives] = useState(SAMPLE_ARCHIVES)
  const [webUrlInput, setWebUrlInput] = useState('')
  const [gmailInput, setGmailInput] = useState('')
  const [adhocUrl, setAdhocUrl] = useState('')
  const [adhocText, setAdhocText] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {month:'numeric', day:'numeric', year:'2-digit'})
  const fullDate = now.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'})
  const ep = 'EP ' + String(Math.floor((now - new Date(now.getFullYear(),0,0))/864e5)).padStart(3,'0')
  const title = `${ep} · Daily Brief — ${dateStr}`

  const activeWebCount = webSources.filter(s => s.on).length
  const activeGmailCount = gmailSources.filter(s => s.on).length

  // Check Gmail connection status on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true)
      setSuccess('Gmail connected successfully!')
      setTimeout(() => setSuccess(''), 4000)
      window.history.replaceState({}, '', '/')
    } else if (params.get('gmail') === 'error') {
      setError('Gmail connection failed. Please try again.')
      setTimeout(() => setError(''), 4000)
      window.history.replaceState({}, '', '/')
    }
    // Check cookie existence via a test call
    fetch('/api/gmail', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ senders: [] })
    }).then(r => r.json()).then(data => {
      if (!data.needsAuth) setGmailConnected(true)
    }).catch(() => {})
  }, [])

  async function generate() {
    setGenerating(true)
    setError('')
    setBrief('')
    setNotebooklm('')

    // Fetch Gmail content if connected
    let emailContent = []
    if (gmailConnected) {
      try {
        const activeSenders = gmailSources.filter(s => s.on)
        const gmailRes = await fetch('/api/gmail', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ senders: activeSenders })
        })
        const gmailData = await gmailRes.json()
        if (gmailData.emails) emailContent = gmailData.emails
        if (gmailData.needsAuth) setGmailConnected(false)
      } catch(e) {
        console.error('Gmail fetch failed:', e)
      }
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          sources: webSources,
          gmailSources,
          gmailContent: emailContent,
          adhocItems,
          tone
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setBrief(data.brief)
      setNotebooklm(data.notebooklm)
      setArchives(prev => [{
        date: dateStr,
        title,
        brief: data.brief.substring(0, 200) + '...',
        sources: activeWebCount + activeGmailCount + adhocItems.length
      }, ...prev].slice(0, 14))
    } catch(e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  function addWebSource() {
    if (!webUrlInput.trim()) return
    const name = webUrlInput.replace(/https?:\/\//,'').split('/')[0]
    setWebSources(prev => [...prev, {name, url:name, type:'custom', badge:'free', on:true}])
    setWebUrlInput('')
  }

  function addGmailSource() {
    if (!gmailInput.trim()) return
    setGmailSources(prev => [...prev, {name:gmailInput, url:gmailInput, type:'newsletter', badge:'gmail', on:true}])
    setGmailInput('')
  }

  function addAdhocUrl() {
    if (!adhocUrl.trim()) return
    setAdhocItems(prev => [...prev, {type:'url', label:adhocUrl.replace(/https?:\/\//,'').substring(0,45), content:adhocUrl}])
    setAdhocUrl('')
  }

  function addAdhocText() {
    if (!adhocText.trim()) return
    setAdhocItems(prev => [...prev, {type:'text', label:adhocText.substring(0,45)+'...', content:adhocText}])
    setAdhocText('')
  }

  return (
    <>
      <style>{styles}</style>

      <header>
        <div className="logo-mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" fill="#0f0f0f"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="#0f0f0f" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className="logo-name">Pavement Podcast</div>
          <div className="logo-sub">AI Editorial Briefing</div>
        </div>
        <div className="header-right">
          <div className="ep-chip">{ep}</div>
          <button className="btn-archive" onClick={() => setDrawerOpen(true)}>Archives</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="tab-bar">
            {['web','gmail','adhoc'].map(t => (
              <div key={t} className={`tab ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>
                {t === 'adhoc' ? 'Ad Hoc' : t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {activeTab === 'web' && (
            <div className="tab-panel active">
              {webSources.map((s,i) => (
                <div key={i} className={`source-row ${s.on?'on':''}`}>
                  <div className="src-icon">{s.name.charAt(0)}</div>
                  <div className="src-info">
                    <div className="src-name">
                      {s.name}
                      <span className={`badge ${BADGE_CLASS[s.badge]||'badge-free'}`}>{BADGE_LABEL[s.badge]||''}</span>
                    </div>
                    <div className="src-meta">{s.url}</div>
                  </div>
                  <div className={`toggle ${s.on?'on':''}`} onClick={() => setWebSources(prev => prev.map((x,j) => j===i?{...x,on:!x.on}:x))} />
                </div>
              ))}
              <div style={{marginTop:'8px'}}>
                <div className="field-label">Add source URL</div>
                <input className="text-input" value={webUrlInput} onChange={e=>setWebUrlInput(e.target.value)} placeholder="https://..." onKeyDown={e=>e.key==='Enter'&&addWebSource()} />
                <button className="btn-small" onClick={addWebSource}>+ Add Web Source</button>
              </div>
            </div>
          )}

          {activeTab === 'gmail' && (
            <div className="tab-panel active">
              <div className="gmail-connect">
                <div className={`gmail-status ${gmailConnected?'connected':'disconnected'}`}>
                  {gmailConnected ? '● Gmail connected' : '○ Gmail not connected'}
                </div>
                <button
                  className={`btn-gmail ${gmailConnected?'connected':''}`}
                  onClick={() => gmailConnected ? null : window.location.href='/api/auth/login'}
                >
                  {gmailConnected ? '✓ Connected — newsletters active' : 'Connect Gmail →'}
                </button>
                {!gmailConnected && <div className="hint">Connect Gmail to pull live newsletter content at generate time.</div>}
              </div>
              {gmailSources.map((s,i) => (
                <div key={i} className={`source-row ${s.on?'on':''} ${!gmailConnected?'':''}`}>
                  <div className="src-icon">{s.name.charAt(0)}</div>
                  <div className="src-info">
                    <div className="src-name">
                      {s.name}
                      <span className={`badge ${BADGE_CLASS[s.badge]||'badge-gmail'}`}>{BADGE_LABEL[s.badge]||''}</span>
                    </div>
                    <div className="src-meta">{s.url}</div>
                  </div>
                  <div className={`toggle ${s.on?'on':''}`} onClick={() => setGmailSources(prev => prev.map((x,j) => j===i?{...x,on:!x.on}:x))} />
                </div>
              ))}
              <div style={{marginTop:'8px'}}>
                <div className="field-label">Add newsletter sender</div>
                <input className="text-input" value={gmailInput} onChange={e=>setGmailInput(e.target.value)} placeholder="sender@domain.com" onKeyDown={e=>e.key==='Enter'&&addGmailSource()} />
                <button className="btn-small" onClick={addGmailSource}>+ Add Sender</button>
              </div>
            </div>
          )}

          {activeTab === 'adhoc' && (
            <div className="tab-panel active">
              <div className="field-label">Article URL</div>
              <input className="text-input" value={adhocUrl} onChange={e=>setAdhocUrl(e.target.value)} placeholder="https://..." onKeyDown={e=>e.key==='Enter'&&addAdhocUrl()} />
              <button className="btn-small" onClick={addAdhocUrl}>+ Add Article</button>
              <div style={{marginTop:'12px'}}>
                <div className="field-label">Paste text or transcript</div>
                <textarea className="text-input" value={adhocText} onChange={e=>setAdhocText(e.target.value)} rows={5} placeholder="Paste article text, podcast transcript, show notes..." />
                <button className="btn-small" onClick={addAdhocText}>+ Add Text</button>
              </div>
              {adhocItems.length > 0 && (
                <div style={{marginTop:'10px',display:'flex',flexDirection:'column',gap:'6px'}}>
                  {adhocItems.map((item,i) => (
                    <div key={i} className="adhoc-item">
                      <div className="src-icon">{item.type==='url'?'U':'T'}</div>
                      <div className="src-info">
                        <div className="src-name" style={{fontSize:'0.75rem',fontWeight:400}}>{item.label}</div>
                        <div className="src-meta">{item.type}</div>
                      </div>
                      <div className="remove-btn" onClick={() => setAdhocItems(prev => prev.filter((_,j)=>j!==i))}>✕</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="tone-row">
            <div className="field-label" style={{marginBottom:'6px'}}>Tone</div>
            <select className="tone-select" value={tone} onChange={e=>setTone(e.target.value)}>
              <option value="sharp and opinionated">Sharp & Opinionated</option>
              <option value="analytical and calm">Analytical & Calm</option>
              <option value="energetic and punchy">Energetic & Punchy</option>
              <option value="thoughtful and nuanced">Thoughtful & Nuanced</option>
            </select>
          </div>
        </aside>

        <main className="main">
          <div className="hero">
            <div className="hero-label">Episode</div>
            <div className="hero-title">{title}</div>
            <div className="hero-date">{fullDate}</div>
            <button className="btn-generate" onClick={generate} disabled={generating}>
              {generating ? (
                <><div className="spinner" /> Generating...</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="#0f0f0f" strokeWidth="1.3"/>
                    <path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="#0f0f0f"/>
                  </svg>
                  Generate Briefing
                </>
              )}
            </button>
            <div className="source-summary">
              {activeWebCount > 0 && <div className="src-pill"><span>{activeWebCount}</span> web</div>}
              {activeGmailCount > 0 && <div className="src-pill"><span>{activeGmailCount}</span> gmail</div>}
              {adhocItems.length > 0 && <div className="src-pill"><span>{adhocItems.length}</span> ad hoc</div>}
            </div>
          </div>

          {error && <div className="error-bar">{error}</div>}
          {success && <div className="success-bar">{success}</div>}

          <div className="output-area">
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Editorial Brief</div>
                <div className="panel-badge">
                  {brief ? `~${Math.round(brief.split(/\s+/).length/140)} min` : '~15 min'}
                </div>
              </div>
              <div className={`panel-body ${!brief?'empty':''}`}>
                {generating ? 'Generating your briefing...' : brief || 'Your generated briefing will appear here. Configure sources on the left, then hit Generate.'}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">NotebookLM Export</div>
                <div className="panel-badge">ready to paste</div>
              </div>
              <div className={`panel-body ${!notebooklm?'empty':''}`}>
                {notebooklm || 'A formatted version optimized for NotebookLM will appear here.'}
              </div>
            </div>
          </div>

          <div className="export-row">
            <span className="export-label">Export</span>
            <button className="btn-export primary" disabled={!notebooklm} onClick={() => copy(notebooklm, 'notebook')}>
              {copied==='notebook' ? 'Copied!' : 'Copy for NotebookLM'}
            </button>
            <button className="btn-export" disabled={!brief} onClick={() => copy(brief, 'brief')}>
              {copied==='brief' ? 'Copied!' : 'Copy Raw Script'}
            </button>
            <button className="btn-export" disabled={!brief} onClick={() => copy(`# ${title}\n\n${brief}`, 'md')}>
              {copied==='md' ? 'Copied!' : 'Copy as Markdown'}
            </button>
          </div>
        </main>
      </div>

      <div className={`drawer-overlay ${drawerOpen?'open':''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`drawer ${drawerOpen?'open':''}`}>
        <div className="drawer-header">
          <div className="drawer-title">Archives</div>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <div className="drawer-body">
          {archives.map((item, i) => (
            <div key={i} className="archive-item">
              <div className="archive-date">{item.date}</div>
              <div className="archive-title">{item.title}</div>
              <div className="archive-preview">{item.brief}</div>
              <div className="archive-meta">{item.sources} sources</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
