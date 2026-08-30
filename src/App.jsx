import React, { useState, useEffect, useRef } from 'react';

function parseMarkdownTable(rows) {
  const parsedRows = rows.map(r =>
    r.split('|').map(cell => cell.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1)
  );
  const contentRows = parsedRows.filter(r => !r.every(cell => cell.startsWith('-') || cell === ''));
  if (contentRows.length === 0) return '';
  const headers = contentRows[0];
  const body = contentRows.slice(1);
  const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${body.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div style="overflow-x:auto;margin:12px 0"><table class="bi-table">${headerHtml}${bodyHtml}</table></div>`;
}

function formatMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = html.split('\n');
  let inTable = false;
  let tableRows = [];
  const processedLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(line);
    } else {
      if (inTable) { processedLines.push(parseMarkdownTable(tableRows)); inTable = false; }
      processedLines.push(line);
    }
  }
  if (inTable) processedLines.push(parseMarkdownTable(tableRows));
  html = processedLines.join('\n');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.*?)`/g, '<span class="code-inline">$1</span>');
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  return html.replace(/\n/g, '<br />');
}

export default function App() {
  const [mondayToken, setMondayToken] = useState('');
  const [dealsBoardId, setDealsBoardId] = useState('5030969646');
  const [workOrdersBoardId, setWorkOrdersBoardId] = useState('5030970264');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncData, setSyncData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogIndex, setExpandedLogIndex] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('monday_token') || '';
    const savedDealsId = localStorage.getItem('monday_deals_id') || '5030969646';
    const savedWOId = localStorage.getItem('monday_wo_id') || '5030970264';
    const savedGeminiKey = localStorage.getItem('gemini_api_key') || '';
    setMondayToken(savedToken);
    setDealsBoardId(savedDealsId);
    setWorkOrdersBoardId(savedWOId);
    setGeminiApiKey(savedGeminiKey);
    if (savedToken && savedDealsId && savedWOId) autoSync(savedToken, savedDealsId, savedWOId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const saveCredentials = (token, dealsId, woId, geminiKey) => {
    localStorage.setItem('monday_token', token);
    localStorage.setItem('monday_deals_id', dealsId);
    localStorage.setItem('monday_wo_id', woId);
    localStorage.setItem('gemini_api_key', geminiKey);
  };

  const autoSync = async (token, dealsId, woId) => {
    setIsSyncing(true);
    setSyncError('');
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mondayToken: token, dealsBoardId: dealsId, workOrdersBoardId: woId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync boards.');
      setSyncData(data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync boards.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = async (e) => {
    e.preventDefault();
    if (!mondayToken || !dealsBoardId || !workOrdersBoardId) {
      setSyncError('Please provide all Monday.com configuration details.');
      return;
    }
    saveCredentials(mondayToken, dealsBoardId, workOrdersBoardId, geminiApiKey);
    await autoSync(mondayToken, dealsBoardId, workOrdersBoardId);
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;
    if (!syncData) { alert('Please configure and sync your Monday.com boards in the sidebar first.'); return; }
    if (!geminiApiKey) { alert('Please provide a Google Gemini API Key in the configuration sidebar.'); return; }
    saveCredentials(mondayToken, dealsBoardId, workOrdersBoardId, geminiApiKey);
    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mondayToken, dealsBoardId, workOrdersBoardId, geminiApiKey, messages: newMessages })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get answer from agent.');
      setMessages([...newMessages, { role: 'assistant', content: data.answer, executionLogs: data.executionLogs || [] }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ **Error querying the agent:** ${err instanceof Error ? err.message : 'Unexpected error'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLog = (msgIndex, logIndex) => {
    const key = `${msgIndex}-${logIndex}`;
    setExpandedLogIndex(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const clearChat = () => setMessages([]);
  const handleLeadershipReport = () => handleSendMessage('Prepare an Executive Leadership Update report containing high-level summaries of revenue metrics, pipeline status, key sector performance, operational completion progress, and project risks. Format it beautifully as a formal report.');

  return (
    <div className={`app-container ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">BI</div>
          <div>
            <h1 style={{ marginBottom: '2px' }}>Monday BI Agent</h1>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>By K. Adithya</div>
          </div>
        </div>

        <form onSubmit={handleSync} className="sidebar-section">
          <div className="section-title">Monday.com Connection</div>
          <div className="input-group"><label htmlFor="monday-token">API Personal Token</label><input id="monday-token" type="password" className="input-field" placeholder="Paste monday token..." value={mondayToken} onChange={e => setMondayToken(e.target.value)} /></div>
          <div className="input-group"><label htmlFor="deals-board">Deals Board ID</label><input id="deals-board" type="text" className="input-field" value={dealsBoardId} onChange={e => setDealsBoardId(e.target.value)} /></div>
          <div className="input-group"><label htmlFor="wo-board">Work Orders Board ID</label><input id="wo-board" type="text" className="input-field" value={workOrdersBoardId} onChange={e => setWorkOrdersBoardId(e.target.value)} /></div>
          <div className="section-title">Cognitive Engine</div>
          <div className="input-group"><label htmlFor="gemini-key">Gemini API Key</label><input id="gemini-key" type="password" className="input-field" placeholder="Paste Gemini API key..." value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} /></div>
          <button type="submit" className="btn" disabled={isSyncing}>{isSyncing ? 'Syncing…' : 'Save & Sync Boards'}</button>
        </form>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div className="section-title">Sync Details</div>
          <div className="status-card">
            <div className="status-row"><span>Connection Status:</span><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className={`status-dot ${syncData ? 'connected' : isSyncing ? 'syncing' : ''}`}></span><span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{syncData ? 'Connected' : isSyncing ? 'Syncing...' : 'Disconnected'}</span></div></div>
            {syncError && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>⚠️ {syncError}</div>}
          </div>
          {syncData && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}><strong>Deals Board:</strong><div style={{ color: '#38bdf8' }}>{syncData.deals.boardName}</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Records: {syncData.deals.rowCount}</div></div>
            <div><strong>Work Orders Board:</strong><div style={{ color: '#38bdf8' }}>{syncData.workOrders.boardName}</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Records: {syncData.workOrders.rowCount}</div></div>
          </div>}
        </div>
      </aside>

      <main className="main-view">
        <header className="top-bar">
          <div className="top-bar-left"><button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? '◀ Hide Settings' : '▶ Settings'}</button><div className="chat-info"><span className="chat-title">Founder Analytics Workspace</span><span className="tag">Gemini 1.5 Flash</span>{syncData && <span className="tag" style={{ background: 'rgba(34,197,94,.1)', borderColor: 'rgba(34,197,94,.2)', color: '#22c55e' }}>Live Data</span>}</div></div>
          <div style={{ display: 'flex', gap: '10px' }}>{syncData && <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '.78rem' }} onClick={handleLeadershipReport}>Executive Update</button>}<button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '.78rem' }} onClick={clearChat}>Clear Chat</button></div>
        </header>

        <section className="messages-container">
          {messages.length === 0 ? <div className="welcome-screen">
            <div className="welcome-header"><h2>Skylark Business Intelligence Workspace</h2><p>Ask founder-level questions about sales pipeline, sector performance, project execution, billing, collections, or risks.</p></div>
            <div className="suggestions-grid">
              <button className="suggestion-card" onClick={() => handleSendMessage('What is our current pipeline status by Deal Stage and total masked value?')}><div className="suggestion-title">Pipeline Analysis</div><div className="suggestion-desc">View deal count, values, stages, and closure probabilities.</div></button>
              <button className="suggestion-card" onClick={() => handleSendMessage('How is our revenue and completion status distributed across sectors like Mining or Powerline?')}><div className="suggestion-title">Sector Performance</div><div className="suggestion-desc">Compare activity and operational performance by sector.</div></button>
              <button className="suggestion-card" onClick={() => handleSendMessage('Show outstanding collections (Amount Receivable) and identify Priority AR accounts.')}><div className="suggestion-title">Billing & AR</div><div className="suggestion-desc">Inspect billed, collected, and receivable values.</div></button>
              <button className="suggestion-card" onClick={() => handleSendMessage('Identify delayed projects and work orders with pause/struck execution status.')}><div className="suggestion-title">Project Risks</div><div className="suggestion-desc">Surface delayed work and execution blockers.</div></button>
            </div>
          </div> : messages.map((msg, index) => <div key={index} className={`message-bubble ${msg.role}`}>
            <div className={`message-header ${msg.role === 'assistant' ? 'assistant-header' : ''}`}>{msg.role === 'user' ? 'Founder Query' : 'Analytics Agent'}</div>
            <div className="message-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}></div>
            {msg.role === 'assistant' && msg.executionLogs?.length > 0 && <div className="execution-log-container"><div className="execution-header" onClick={() => toggleLog(index, 0)}><span>Python Analysis Sandbox</span><span>{expandedLogIndex[`${index}-0`] ? 'Collapse' : 'Expand Code'}</span></div>{expandedLogIndex[`${index}-0`] && <div className="execution-body">{msg.executionLogs.map((log, i) => <div key={i}>{log.type === 'code' ? <pre className="execution-code"><code>{log.code}</code></pre> : <pre className="execution-result"><code>{log.output}</code></pre>}</div>)}</div>}</div>}
          </div>)}
          {isLoading && <div className="message-bubble assistant"><div className="message-header assistant-header">Analytics Agent</div><div className="message-content"><span className="loader"><span className="loader-dot"></span><span className="loader-dot"></span><span className="loader-dot"></span></span> Running data cleaning and analysis…</div></div>}
          <div ref={messagesEndRef} />
        </section>

        <footer className="input-area"><div className="input-container"><input type="text" className="chat-input" placeholder={syncData ? 'Ask about revenue, pipeline, sectoral health, delayed projects...' : 'Configure boards in the settings panel to begin...'} value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={isLoading || !syncData} /><button className="send-btn" onClick={() => handleSendMessage()} disabled={isLoading || !syncData || !inputMessage.trim()}>➜</button></div></footer>
      </main>
    </div>
  );
}
