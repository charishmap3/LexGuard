import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, Bell, BookOpen, Check, ChevronDown,
  ChevronRight, CircleHelp, ClipboardCheck, FileSearch, FileText, FolderOpen,
  GitCompareArrows, LayoutDashboard, Lightbulb, Menu, MessageSquare, Plus,
  Scale, Search, ShieldCheck, Sparkles, UploadCloud, X, Zap,
} from 'lucide-react'

type Attention = 'Low' | 'Medium' | 'High'
type Clause = { title: string; category: string; importance: Attention; plain_language: string; original_text: string; why_it_matters: string }
type Analysis = {
  document_type: string; executive_summary: string; overall_attention: Attention
  key_clauses: Clause[]; risks: { title: string; severity: Attention; description: string; source_clause: string }[]
  obligations: { party: string; obligation: string; deadline: string; consequence: string }[]
  important_dates: { event: string; date: string; source: string }[]
  termination_conditions: string[]; renewal_conditions: string[]; questions_for_lawyer: string[]
}
type Comparison = { category: string; clause: string; old_text: string; new_text: string; change_type: string; importance: Attention; explanation: string }

const demoAnalysis: Analysis = {
  document_type: 'Employment Agreement',
  executive_summary: 'This agreement sets out the terms of employment, including compensation, confidentiality, intellectual property ownership, and how either party can end the relationship. The areas that deserve the closest review are the broad IP assignment and the 90-day notice period.',
  overall_attention: 'Medium',
  key_clauses: [
    { title: 'Compensation & payment', category: 'Money', importance: 'High', plain_language: 'You will receive ₹1,20,000 per month, paid on the last working day of each month.', original_text: 'The Company shall pay the Employee a monthly gross salary of INR 1,20,000, payable on the last working day of every calendar month.', why_it_matters: 'This is the core payment obligation. Confirm the amount, timing, and whether deductions or variable pay are described elsewhere.' },
    { title: 'Confidentiality', category: 'Restrictions', importance: 'Medium', plain_language: 'Information you learn through work must stay confidential during and after employment.', original_text: 'The Employee shall keep all Confidential Information strictly confidential during employment and for a period of three years thereafter.', why_it_matters: 'The three-year period continues after the job ends. Ask which information is covered and what exceptions apply.' },
    { title: 'Intellectual property', category: 'Ownership', importance: 'High', plain_language: 'Work product created in connection with your role belongs to the company, including some work created outside office hours.', original_text: 'All inventions, works, discoveries and developments created in connection with the Employee’s duties shall be the exclusive property of the Company.', why_it_matters: 'The phrase “in connection with” may be broad. Clarify how personal projects and pre-existing work are treated.' },
    { title: 'Notice period', category: 'Exit', importance: 'High', plain_language: 'Either party must give 90 days written notice to end employment, unless the company chooses payment in lieu.', original_text: 'Either party may terminate this Agreement by giving ninety (90) days prior written notice. The Company may waive the notice period by paying salary in lieu.', why_it_matters: 'A long notice period can affect when you can move roles. Confirm whether the employee can also pay in lieu.' },
  ],
  risks: [
    { title: 'Broad IP assignment', severity: 'High', description: 'The ownership language does not clearly exclude personal projects that overlap with the company’s business.', source_clause: 'Section 7 — Intellectual Property' },
    { title: 'Uneven notice option', severity: 'Medium', description: 'The company can waive notice by paying salary, but an equivalent employee option is not stated.', source_clause: 'Section 10 — Termination' },
    { title: 'Post-employment confidentiality', severity: 'Low', description: 'Confidentiality continues for three years after employment ends.', source_clause: 'Section 6 — Confidentiality' },
  ],
  obligations: [
    { party: 'You', obligation: 'Keep company information confidential', deadline: 'During employment + 3 years', consequence: 'Not specified in the document.' },
    { party: 'You', obligation: 'Give written notice before resigning', deadline: '90 days before last day', consequence: 'Not specified in the document.' },
    { party: 'Company', obligation: 'Pay monthly gross salary', deadline: 'Last working day each month', consequence: 'Not specified in the document.' },
  ],
  important_dates: [
    { event: 'Employment start date', date: '01 April 2025', source: 'Section 2' },
    { event: 'Notice period', date: '90 days', source: 'Section 10' },
    { event: 'Confidentiality end', date: '3 years after employment', source: 'Section 6' },
  ],
  termination_conditions: ['Either party can terminate with 90 days prior written notice.', 'The company may waive the notice period by paying salary in lieu.', 'Immediate termination grounds are not specified in the document.'],
  renewal_conditions: ['Not specified in the document.'],
  questions_for_lawyer: ['Does the IP clause cover projects I create in my personal time?', 'Can I pay salary in lieu of the 90-day notice period?', 'What remedies apply if confidentiality is breached?'],
}

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Analyze document', icon: FileSearch },
  { label: 'Ask LexGuard', icon: MessageSquare },
  { label: 'Compare documents', icon: GitCompareArrows },
]

const routes: Record<string, string> = {
  '/': 'Overview',
  '/overview': 'Overview',
  '/analyze': 'Analyze document',
  '/ask': 'Ask LexGuard',
  '/compare': 'Compare documents',
}

function Badge({ value }: { value: Attention | string }) {
  return <span className={`badge badge-${value.toLowerCase()}`}><span className="badge-dot" />{value}</span>
}

function buildReviewChecklist(analysis: Analysis): string[] {
  const items = [
    ...analysis.risks.map(risk => `Review ${risk.title.toLowerCase()}`),
    ...analysis.obligations.slice(0, 2).map(obligation => `Confirm ${obligation.obligation.toLowerCase()}`),
    ...analysis.important_dates.slice(0, 2).map(date => `Verify ${date.event.toLowerCase()} (${date.date})`),
    ...analysis.termination_conditions
      .filter(condition => !condition.toLowerCase().includes('not specified'))
      .slice(0, 1)
      .map(condition => `Review termination terms: ${condition}`),
    ...analysis.renewal_conditions
      .filter(condition => !condition.toLowerCase().includes('not specified'))
      .slice(0, 1)
      .map(condition => `Confirm renewal terms: ${condition}`),
    ...analysis.questions_for_lawyer.slice(0, 1).map(question => `Discuss with a lawyer: ${question}`),
  ]

  return [...new Set(items)].slice(0, 6)
}

function App() {
  const [active, setActive] = useState(() => routes[window.location.pathname] || 'Overview')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [isAsking, setIsAsking] = useState(false)
  const [expandedClause, setExpandedClause] = useState<number | null>(0)
  const [compareMode, setCompareMode] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handlePopState = () => setActive(routes[window.location.pathname] || 'Overview')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (label: string) => {
    const path = Object.entries(routes).find(([, route]) => route === label)?.[0] || '/'
    window.history.pushState({}, '', path)
    setActive(label)
    if (label === 'Compare documents') setCompareMode(true)
  }

  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 2800) }
  const loadDemo = () => {
    setMessages([])
    setQuery('')
    setIsDemo(true)
    setFileName('Acme_Employment_Agreement.pdf')
    setSelectedFile(null)
    setAnalysis(demoAnalysis)
    navigate('Overview')
    showToast('Demo agreement loaded — explore the analysis')
  }
  const startAnalysis = async () => {
    if (!fileName) { inputRef.current?.click(); return }
    if (isDemo) { setAnalysis(demoAnalysis); navigate('Overview'); return }
    if (!selectedFile) { showToast('Select a document before analyzing.'); return }
    setAnalysis(null)
    setMessages([])
    setQuery('')
    setAnalysisError('')
    setIsAnalyzing(true)
    try {
      const body = new FormData()
      body.append('file', selectedFile)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/analyze`, { method: 'POST', body })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || 'AI analysis failed. Please try again.')
      }
      setAnalysis(await response.json())
      navigate('Overview')
      showToast('Analysis complete')
    } catch (error) {
      const message = error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'Unable to analyze this document. Please check that the backend is running and try again.'
      setAnalysisError(message)
      navigate('Analyze document')
      showToast(message)
    } finally {
      setIsAnalyzing(false)
    }
  }
  const onFile = (file?: File) => {
    if (!file) { setFileName(''); setSelectedFile(null); setAnalysis(null); setMessages([]); setQuery(''); setIsDemo(false); return }
    if (!['application/pdf', 'text/plain'].includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) { showToast('Please choose a PDF or TXT file'); return }
    if (file.size > 10 * 1024 * 1024) { showToast('Files must be smaller than 10 MB'); return }
    setFileName(file.name)
    setSelectedFile(file)
    setIsDemo(false)
    setAnalysis(null)
    setMessages([])
    setQuery('')
    showToast('Document ready to analyze')
  }
  const askQuestion = async () => {
    if (!query.trim()) return
    const question = query.trim()
    setQuery('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    if (isDemo) {
      setMessages(prev => [...prev, { role: 'assistant', text: answerFor(question) }])
      return
    }
    if (!selectedFile) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'No current document is connected. Analyze a document before asking a question.' }])
      return
    }
    try {
      setIsAsking(true)
      const body = new FormData()
      body.append('file', selectedFile)
      body.append('question', question)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/ask`, { method: 'POST', body })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || 'Unable to answer this question. Please try again.')
      }
      const result = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', text: result.answer }])
    } catch (error) {
      const message = error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'Unable to answer this question. Please check that the backend is running and try again.'
      setMessages(prev => [...prev, { role: 'assistant', text: message }])
    } finally {
      setIsAsking(false)
    }
  }
  const answerFor = (question: string) => {
    const q = question.toLowerCase()
    if (q.includes('terminate') || q.includes('notice')) return 'Based on Section 10, either party may end the agreement with 90 days’ prior written notice. The company may waive its notice period by paying salary in lieu. The document does not clearly state whether you can make the same payment.\\n\\nSource: Section 10 — Termination.\\n\\nThis is an informational interpretation, not legal advice.'
    if (q.includes('salary') || q.includes('payment')) return 'Section 4 states that the monthly gross salary is INR 1,20,000, payable on the last working day of each calendar month.\\n\\nSource: Section 4 — Compensation.'
    if (q.includes('obligation')) return 'The clearest obligations are to keep company information confidential, assign qualifying work product to the company, and provide 90 days’ written notice before resigning.\\n\\nSource: Sections 6, 7 and 10.'
    return 'The document does not contain enough information to answer that confidently. Try asking about termination, salary, notice, confidentiality, or obligations.\\n\\nThis is an informational interpretation, not legal advice.'
  }

  const stats = useMemo(() => analysis ? [
    { label: 'Key clauses', value: analysis.key_clauses.length, icon: BookOpen, tone: 'blue' },
    { label: 'Needs attention', value: analysis.risks.length, icon: AlertTriangle, tone: 'orange' },
    { label: 'Obligations', value: analysis.obligations.length, icon: ClipboardCheck, tone: 'green' },
  ] : [], [analysis])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Scale size={18} /></div><span>lex<span>guard</span></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => navigate(label)}><Icon size={18} /><span>{label}</span>{label === 'Ask LexGuard' && analysis && <i className="nav-dot" />}</button>)}</nav>
        <div className="sidebar-bottom">
          <button className="demo-link" onClick={loadDemo}><Sparkles size={17} /> Try interactive demo <ArrowRight size={15} /></button>
          <div className="trust-card"><ShieldCheck size={18} /><div><strong>Your documents stay private</strong><small>Processed securely for your session.</small></div></div>
          <div className="user-profile"><div className="avatar">AP</div><div><strong>Alex Patel</strong><small>Personal workspace</small></div><ChevronDown size={16} /></div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="crumb"><span>Workspace</span><ChevronRight size={14} /><b>{active}</b></div><div className="top-actions"><button className="icon-button"><Bell size={18} /></button><button className="help-button"><CircleHelp size={17} /> Help</button></div></header>
        <div className="page">
          {!analysis && active === 'Overview' && <Landing onDemo={loadDemo} onUpload={() => inputRef.current?.click()} />}
          {(active === 'Analyze document' || (active === 'Overview' && !analysis && fileName)) && <UploadPanel fileName={fileName} onFile={onFile} onAnalyze={startAnalysis} onDemo={loadDemo} isAnalyzing={isAnalyzing} inputRef={inputRef} error={analysisError} />}
          {analysis && active === 'Overview' && <Dashboard analysis={analysis} fileName={fileName} stats={stats} expandedClause={expandedClause} setExpandedClause={setExpandedClause} onAsk={() => navigate('Ask LexGuard')} onCompare={() => navigate('Compare documents')} />}
          {active === 'Ask LexGuard' && <Chat messages={messages} query={query} setQuery={setQuery} onAsk={askQuestion} hasDocument={!!analysis} onDemo={loadDemo} isAsking={isAsking} />}
          {active === 'Compare documents' && <Compare onDemo={loadDemo} active={compareMode} showToast={showToast} />}
        </div>
      </main>
      <input ref={inputRef} hidden type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={e => onFile(e.target.files?.[0])} />
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  )
}

function Landing({ onDemo, onUpload }: { onDemo: () => void; onUpload: () => void }) {
  return <div className="landing">
    <div className="eyebrow"><Sparkles size={15} /> INTELLIGENCE FOR EVERY AGREEMENT</div>
    <h1>Make every clause<br /><em>make sense.</em></h1>
    <p className="hero-copy">LexGuard turns dense legal documents into clear, actionable insights — so you know what matters before speaking with a legal professional.</p>
    <div className="hero-actions"><button className="primary-button" onClick={onUpload}>Analyze a document <ArrowRight size={17} /></button><button className="secondary-button" onClick={onDemo}><Sparkles size={16} /> Try the demo</button></div>
    <p className="hero-note"><ShieldCheck size={15} /> Private by design&nbsp; · &nbsp;No legal advice&nbsp; · &nbsp;Built for clarity</p>
    <div className="feature-grid">{[
      [FileSearch, 'AI document analysis', 'Go from legalese to a clear executive summary in seconds.'],
      [AlertTriangle, 'Risk & clause detection', 'Surface important terms, obligations and attention areas.'],
      [MessageSquare, 'Ask your document', 'Get grounded answers with the exact source clause attached.'],
      [GitCompareArrows, 'Compare contracts', 'See what changed between two versions at a glance.'],
    ].map(([Icon, title, desc], i) => <div className="feature-card" key={title as string}><div className={`feature-icon fi-${i}`}><Icon size={19} /></div><h3>{title as string}</h3><p>{desc as string}</p><ChevronRight size={16} className="feature-arrow" /></div>)}</div>
    <div className="disclaimer"><Scale size={18} /><span><strong>Responsible AI, always.</strong> LexGuard provides informational assistance only and does not provide legal advice. Consult a qualified legal professional for legal decisions.</span></div>
  </div>
}

function UploadPanel({ fileName, onFile, onAnalyze, onDemo, isAnalyzing, inputRef, error }: { fileName: string; onFile: (f?: File) => void; onAnalyze: () => void; onDemo: () => void; isAnalyzing: boolean; inputRef: React.RefObject<HTMLInputElement>; error: string }) {
  const [dragging, setDragging] = useState(false)
  return <section className="upload-page"><div className="section-heading"><div><div className="eyebrow">STEP 01 / DOCUMENT</div><h2>What would you like to understand?</h2><p>Upload an agreement and LexGuard will map the clauses, risks and obligations for you.</p></div><div className="format-note"><FileText size={16} /> PDF or TXT · max 10 MB</div></div>
    <div className={dragging ? 'dropzone dragging' : 'dropzone'} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]) }} onClick={() => inputRef.current?.click()}><div className="upload-icon"><UploadCloud size={28} /></div><h3>{fileName || 'Drop your document here'}</h3><p>{fileName ? 'Click to choose a different file' : 'or browse from your computer'}</p><button className="browse-button" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}><FolderOpen size={16} /> Browse files</button></div>
    {fileName && <div className="file-row"><div className="file-type"><FileText size={20} /></div><div className="file-meta"><strong>{fileName}</strong><span>Ready to process · securely held in this session</span></div><button className="remove-file" onClick={() => onFile(undefined)}><X size={17} /></button></div>}
    {error && <div className="upload-error" role="alert"><AlertTriangle size={17} /><div><strong>Unable to analyze this document</strong><span>{error}</span></div><button onClick={onAnalyze}>Retry analysis</button></div>}
    <div className="upload-actions"><button className="primary-button" disabled={isAnalyzing} onClick={onAnalyze}>{isAnalyzing ? <><span className="spinner" /> Reading document…</> : <>Analyze document <Zap size={16} /></>}</button><button className="text-button" onClick={onDemo}><Sparkles size={15} /> Use a demo agreement instead</button></div>
    <div className="upload-steps"><span className="step-done"><Check size={14} /> Upload</span><span><span className="step-line" /> 02&nbsp; AI analysis</span><span><span className="step-line" /> 03&nbsp; Insights</span></div>
  </section>
}

function Dashboard({ analysis, fileName, stats, expandedClause, setExpandedClause, onAsk, onCompare }: { analysis: Analysis; fileName: string; stats: { label: string; value: number; icon: typeof BookOpen; tone: string }[]; expandedClause: number | null; setExpandedClause: (n: number | null) => void; onAsk: () => void; onCompare: () => void }) {
  const reviewChecklist = buildReviewChecklist(analysis)
  return <section className="dashboard"><div className="dashboard-head"><div><div className="eyebrow"><span className="live-dot" /> ANALYSIS COMPLETE</div><h2>{analysis.document_type}</h2><p className="document-name"><FileText size={15} /> {fileName || 'Acme_Employment_Agreement.pdf'} <span>·</span> Just now</p></div><div className="dashboard-actions"><button className="secondary-button" onClick={onCompare}><GitCompareArrows size={16} /> Compare</button><button className="primary-button small" onClick={onAsk}><MessageSquare size={16} /> Ask LexGuard</button></div></div>
    <div className="attention-banner"><div className="attention-symbol"><BarChart3 size={22} /></div><div><span>OVERALL ATTENTION LEVEL</span><strong>{analysis.overall_attention} <Badge value={analysis.overall_attention} /></strong></div><p>We found {analysis.risks.length} areas that may deserve a closer review.</p></div>
    <div className="stat-grid">{stats.map(({ label, value, icon: Icon, tone }) => <div className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="dashboard-grid"><div className="main-column"><div className="content-card summary-card"><div className="card-heading"><div><span className="card-kicker">AT A GLANCE</span><h3>Executive summary</h3></div><Lightbulb size={19} /></div><p>{analysis.executive_summary}</p></div>
      <div className="content-card"><div className="card-heading"><div><span className="card-kicker">CLAUSE MAP</span><h3>Key clauses</h3></div><span className="count-label">{analysis.key_clauses.length} found</span></div><div className="clause-list">{analysis.key_clauses.map((clause, i) => <div className={expandedClause === i ? 'clause open' : 'clause'} key={clause.title}><button className="clause-toggle" onClick={() => setExpandedClause(expandedClause === i ? null : i)}><div className="clause-number">0{i + 1}</div><div className="clause-title"><strong>{clause.title}</strong><span>{clause.category}</span></div><Badge value={clause.importance} /><ChevronDown size={17} className="chevron" /></button>{expandedClause === i && <div className="clause-detail"><div><span>PLAIN LANGUAGE</span><p>{clause.plain_language}</p></div><div><span>WHY IT MATTERS</span><p>{clause.why_it_matters}</p></div><div className="source-quote"><span>SOURCE TEXT</span><p>“{clause.original_text}”</p></div></div>}</div>)}</div></div>
    </div><aside className="side-column"><div className="content-card risk-card"><div className="card-heading"><div><span className="card-kicker">ATTENTION AREAS</span><h3>Review these next</h3></div><AlertTriangle size={19} /></div>{analysis.risks.map(risk => <div className="risk-item" key={risk.title}><div className="risk-top"><strong>{risk.title}</strong><Badge value={risk.severity} /></div><p>{risk.description}</p><span className="source-link"><BookOpen size={13} /> {risk.source_clause}</span></div>)}</div><div className="content-card checklist-card"><div className="card-heading"><div><span className="card-kicker">REVIEW CHECKLIST</span><h3>Before you sign / act</h3></div><ClipboardCheck size={19} /></div>{reviewChecklist.map(item => <label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</div></aside></div>
  </section>
}

function Chat({ messages, query, setQuery, onAsk, hasDocument, onDemo, isAsking }: { messages: { role: 'user' | 'assistant'; text: string }[]; query: string; setQuery: (s: string) => void; onAsk: () => void; hasDocument: boolean; onDemo: () => void; isAsking: boolean }) {
  return <section className="chat-page"><div className="section-heading"><div><div className="eyebrow"><MessageSquare size={14} /> DOCUMENT-GROUNDED Q&A</div><h2>Ask LexGuard</h2><p>Ask questions in plain language. Answers stay grounded in your uploaded document.</p></div><div className="grounded-pill"><span className={hasDocument ? 'live-dot' : 'grey-dot'} /> {hasDocument ? 'Document connected' : 'No document loaded'}</div></div>{!hasDocument ? <div className="empty-state"><div className="empty-icon"><FileSearch size={25} /></div><h3>Connect a document to start asking</h3><p>Load the interactive demo or analyze your own agreement first.</p><button className="primary-button" onClick={onDemo}><Sparkles size={16} /> Load demo agreement</button></div> : <div className="chat-card"><div className="chat-history">{messages.length === 0 && <div className="chat-welcome"><div className="assistant-avatar"><Sparkles size={18} /></div><h3>What do you want to know?</h3><p>Try one of these questions, or write your own.</p><div className="suggestion-list">{['What are my main obligations?', 'What should I review before signing?', 'When can this agreement be terminated?'].map(q => <button key={q} onClick={() => { setQuery(q); window.setTimeout(onAsk, 0) }}>{q}<ArrowRight size={14} /></button>)}</div></div>}{messages.map((message, i) => <div className={`message ${message.role}`} key={`${message.text}-${i}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={14} /> : 'AP'}</div><div className="message-bubble">{message.text.split('\\n').map((line, j) => <p key={j}>{line || <>&nbsp;</>}</p>)}</div></div>)}{isAsking && <div className="message assistant thinking-message"><div className="message-avatar"><Sparkles size={14} /></div><div className="message-bubble"><span className="thinking-dots" /> LexGuard is checking your document…</div></div>}</div><div className="chat-input"><input disabled={isAsking} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAsk()} placeholder="Ask about a clause, obligation, deadline…" /><button disabled={isAsking} onClick={onAsk} aria-label="Send question"><ArrowRight size={18} /></button></div><p className="chat-disclaimer"><ShieldCheck size={13} /> Answers are informational and based only on the connected document — not legal advice.</p></div>}</section>
}

function Compare({ onDemo, active, showToast }: { onDemo: () => void; active: boolean; showToast: (text: string) => void }) {
  const [compared, setCompared] = useState(false)
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [result, setResult] = useState<Comparison[] | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const inputA = useRef<HTMLInputElement>(null)
  const inputB = useRef<HTMLInputElement>(null)
  const chooseFile = (file: File | undefined, setter: (file: File | null) => void) => {
    if (!file) return
    if (!['application/pdf', 'text/plain'].includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) { showToast('Please choose a PDF or TXT file'); return }
    if (file.size > 10 * 1024 * 1024) { showToast('Files must be smaller than 10 MB'); return }
    setter(file)
  }
  const runComparison = async () => {
    if (!fileA || !fileB) { showToast('Select both documents before comparing.'); return }
    setIsComparing(true)
    try {
      const body = new FormData()
      body.append('file_a', fileA)
      body.append('file_b', fileB)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/compare`, { method: 'POST', body })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.detail || 'Document comparison failed. Please try again.')
      }
      const payload = await response.json()
      setResult(payload.changes)
      setCompared(true)
      showToast('Comparison complete')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Document comparison failed. Please try again.')
    } finally {
      setIsComparing(false)
    }
  }
  return <section className="compare-page"><div className="section-heading"><div><div className="eyebrow"><GitCompareArrows size={14} /> VERSION INTELLIGENCE</div><h2>Compare contracts</h2><p>Spot meaningful changes between two versions without reading every line twice.</p></div><div className="format-note"><Sparkles size={15} /> Neutral, clause-level comparison</div></div>{!compared ? <><div className="compare-upload-grid"><CompareBox label="Contract A" version={fileA?.name || 'Previous version'} onDemo={onDemo} onChoose={() => inputA.current?.click()} /><div className="versus">VS</div><CompareBox label="Contract B" version={fileB?.name || 'New version'} onDemo={onDemo} onChoose={() => inputB.current?.click()} /></div><input ref={inputA} hidden type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={e => chooseFile(e.target.files?.[0], setFileA)} /><input ref={inputB} hidden type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={e => chooseFile(e.target.files?.[0], setFileB)} /><button className="primary-button compare-button" onClick={runComparison} disabled={isComparing}>{isComparing ? <><span className="spinner" /> Comparing…</> : <><GitCompareArrows size={17} /> Compare these documents</>}</button><p className="compare-footnote"><ShieldCheck size={14} /> Changes are described neutrally. LexGuard does not decide whether a change is legally harmful.</p></> : <div className="comparison-result"><div className="result-head"><div><span className="card-kicker">COMPARISON COMPLETE</span><h3>{result?.length || 0} meaningful changes found</h3><p>{fileA?.name} · Previous vs {fileB?.name}</p></div><button className="secondary-button" onClick={() => { setCompared(false); setResult(null) }}>Compare again</button></div><div className="comparison-summary"><BarChart3 size={18} /><span>Changes were extracted from the two uploaded documents and described neutrally.</span></div>{result?.map((item, i) => <div className="change-row" key={`${item.clause}-${i}`}><div className="change-index">0{i + 1}</div><div className="change-main"><div className="change-title"><strong>{item.clause}</strong><span>{item.category}</span><Badge value={item.importance} /></div><div className="change-values"><div><small>PREVIOUS</small><p>{item.old_text}</p></div><ArrowRight size={17} /><div><small>NEW VERSION</small><p className="new-value">{item.new_text}</p></div><span className={`change-type change-${item.change_type.toLowerCase()}`}>{item.change_type}</span></div><p className="change-explanation">{item.explanation}</p></div></div>)}</div>}</section>
}
function CompareBox({ label, version, onDemo, onChoose }: { label: string; version: string; onDemo: () => void; onChoose: () => void }) {
  return <div className="compare-box"><div className="compare-label"><span>{label}</span><small>{version}</small></div><button onClick={onChoose}><div className="upload-icon small"><UploadCloud size={20} /></div><strong>{version.includes('.') ? 'Choose a different document' : 'Drop a document'}</strong><span>or browse files</span></button><div className="demo-mini" onClick={onDemo}><Sparkles size={13} /> Use demo version</div></div>
}

export default App
