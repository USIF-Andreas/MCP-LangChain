import { useState, useRef, useEffect, useCallback } from "react";

const API_URL      = "https://expert-waddle-x5vq9j5w7rwh6q7q-8000.app.github.dev";
const OLLAMA_URL   = "https://expert-waddle-x5vq9j5w7rwh6q7q-11434.app.github.dev";

const TOOLS_META = {
  get_weather: { icon: "⛅", color: "#38bdf8" },
  calculate:   { icon: "🧮", color: "#a78bfa" },
  save_note:   { icon: "📝", color: "#34d399" },
};

const EXAMPLES = [
  "What's the weather in Cairo? And in Tokyo?",
  "Calculate 1337 * 42 and 9999 / 3",
  "Get weather in London, then save a note saying 'mission complete'",
];

const PROVIDER_MODELS = {
  ollama:    ["llama3.2", "qwen2.5", "mistral", "gemma2", "phi3"],
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"],
};

// ── Status dot ────────────────────────────────────────────────
function StatusDot({ status }) {
  const colors = { ok: "#22c55e", error: "#ef4444", checking: "#f59e0b", unknown: "#475569" };
  const color = colors[status] || colors.unknown;
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color,
      boxShadow: status === "ok" ? `0 0 6px ${color}` : "none",
      animation: status === "checking" ? "pulse 1s infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

// ── Status bar ────────────────────────────────────────────────
function StatusBar({ provider, statuses, onCheck }) {
  const s = statuses;

  const items = [
    {
      label: "FastAPI backend",
      status: s.backend,
      hint: s.backend === "error" ? "uvicorn backend:app --reload --port 8000" : null,
    },
    provider === "ollama"
      ? {
          label: "Ollama",
          status: s.ollama,
          hint: s.ollama === "error" ? "ollama serve" : null,
          model: s.ollamaModel,
        }
      : {
          label: "Anthropic API key",
          status: s.anthropic,
          hint: s.anthropic === "error" ? "export ANTHROPIC_API_KEY=..." : null,
        },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: "8px 14px", background: "#0a0f1a",
      border: "1px solid #1e293b", borderRadius: 10, marginTop: 10,
      fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot status={item.status} />
          <span style={{ color: item.status === "ok" ? "#94a3b8" : item.status === "error" ? "#f87171" : "#64748b" }}>
            {item.label}
            {item.model && <span style={{ color: "#a78bfa" }}> ({item.model})</span>}
          </span>
          {item.hint && (
            <span style={{
              background: "#1e293b", color: "#60a5fa", borderRadius: 4,
              padding: "1px 7px", fontSize: 10, cursor: "default",
            }} title="Run this command">
              {item.hint}
            </span>
          )}
        </div>
      ))}

      <button onClick={onCheck} style={{
        marginLeft: "auto", background: "transparent", border: "1px solid #1e293b",
        borderRadius: 6, color: "#64748b", padding: "2px 10px", fontSize: 11,
        cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
        transition: "all 0.2s",
      }}
        onMouseEnter={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.color = "#93c5fd"; }}
        onMouseLeave={e => { e.target.style.borderColor = "#1e293b"; e.target.style.color = "#64748b"; }}
      >
        ↻ recheck
      </button>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────
function StepCard({ step }) {
  const meta   = TOOLS_META[step.tool] || { icon: "🔧", color: "#f59e0b" };
  const styles = {
    tool_call:   { bg: "#0c1a2e", border: "#1d4ed8", label: "🔧 Tool Call",  labelColor: "#60a5fa" },
    tool_result: { bg: "#0a1f14", border: "#15803d", label: "✅ Result",      labelColor: "#4ade80" },
    thinking:    { bg: "#0f172a", border: "#334155", label: "🤔 Thinking",    labelColor: "#94a3b8" },
    error:       { bg: "#1f0a0a", border: "#dc2626", label: "❌ Error",       labelColor: "#f87171" },
  };
  const s = styles[step.type] || styles.thinking;

  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "12px 16px", animation: "slideIn 0.3s ease both" }}>
      <div style={{ fontSize: 11, color: s.labelColor, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
        {s.label}{step.tool && <span style={{ color: meta.color }}> · {meta.icon} {step.tool}</span>}
      </div>
      {step.type === "tool_call" && (
        <pre style={{ background: "#020817", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", margin: 0, overflowX: "auto" }}>
          {JSON.stringify(step.args, null, 2)}
        </pre>
      )}
      {step.type === "tool_result" && <div style={{ color: "#4ade80", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{step.result}</div>}
      {(step.type === "thinking" || step.type === "error") && <div style={{ color: step.type === "error" ? "#f87171" : "#94a3b8", fontSize: 13 }}>{step.text}</div>}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);
  const [provider, setProvider] = useState("ollama");
  const [model, setModel]     = useState("");
  const [statuses, setStatuses] = useState({
    backend: "unknown", ollama: "unknown", anthropic: "unknown", ollamaModel: null,
  });
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Status checker ──────────────────────────────────────────
  const checkStatuses = useCallback(async () => {
    setStatuses(s => ({ ...s, backend: "checking", ollama: "checking", anthropic: "checking" }));

    // 1. Check FastAPI backend
    let backendOk = false;
    try {
      const r = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
      backendOk = r.ok;
    } catch {}
    setStatuses(s => ({ ...s, backend: backendOk ? "ok" : "error" }));

    // 2. Check Ollama — /api/tags lists available models
    let ollamaOk = false;
    let ollamaModel = null;
    try {
      const r = await fetch(`${API_URL}/check-ollama`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const data = await r.json(); ollamaOk = data.ok; ollamaModel = data.models?.join(", ") || null;
        const models = data.models || [];
        ollamaOk = true;
        // Show which models are pulled
        ollamaModel = models.length > 0
          ? models.map(m => m.name.split(":")[0]).slice(0, 3).join(", ")
          : "no models pulled";
      }
    } catch {}
    setStatuses(s => ({ ...s, ollama: ollamaOk ? "ok" : "error", ollamaModel }));

    // 3. Check Anthropic key via backend health (backend exposes it)
    let anthropicOk = false;
    try {
      const r = await fetch(`${API_URL}/check-anthropic`, { signal: AbortSignal.timeout(4000) });
      anthropicOk = r.ok && (await r.json()).ok;
    } catch {}
    setStatuses(s => ({ ...s, anthropic: anthropicOk ? "ok" : "error" }));
  }, []);

  // Auto-check on mount and every 30s
  useEffect(() => {
    checkStatuses();
    const id = setInterval(checkStatuses, 30000);
    return () => clearInterval(id);
  }, [checkStatuses]);

  // Re-check when provider changes
  useEffect(() => { checkStatuses(); }, [provider]);

  const allReady = statuses.backend === "ok" && (
    provider === "ollama" ? statuses.ollama === "ok" : statuses.anthropic === "ok"
  );

  // ── Send message ────────────────────────────────────────────
  async function handleSubmit(msg) {
    const text = (msg || input).trim();
    if (!text || running) return;
    setInput("");
    setRunning(true);

    const userMsg  = { role: "user", text };
    const agentMsg = { role: "agent", steps: [], answer: "", streaming: true };
    setMessages(prev => [...prev, userMsg, agentMsg]);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, provider, model: model || undefined }),
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let steps = [], answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          const event = JSON.parse(line.slice(6));
          if (event.type === "tool_call")   steps = [...steps, { type: "tool_call",   tool: event.tool, args: event.args }];
          if (event.type === "tool_result") steps = [...steps, { type: "tool_result", tool: event.tool, result: event.result }];
          if (event.type === "token")       answer += event.text;
          if (event.type === "error")       steps = [...steps, { type: "error", text: event.message }];
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: "agent", steps, answer, streaming: event.type !== "done" };
            return next;
          });
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "agent",
          steps: [{ type: "error", text: `Cannot reach backend at ${API_URL} — is it running?` }],
          answer: "", streaming: false,
        };
        return next;
      });
    }
    setRunning(false);
    checkStatuses(); // refresh after run
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020817; color: #e2e8f0; font-family: 'Inter', sans-serif; min-height: 100vh; }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .pill:hover { background:#1e293b!important; border-color:#3b82f6!important; color:#93c5fd!important; }
        .send:hover:not(:disabled) { background:#1d4ed8!important; }
        .send:disabled { opacity:.4; cursor:not-allowed; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#334155; border-radius:4px; }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100vh", maxWidth:860, margin:"0 auto", padding:"0 16px" }}>

        {/* ── Header ── */}
        <div style={{ padding:"18px 0 14px", borderBottom:"1px solid #1e293b", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>

            {/* Title */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🤖</div>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, letterSpacing:"-0.5px" }}>
                  LangChain <span style={{ color:"#3b82f6" }}>×</span> MCP Agent
                </div>
                <div style={{ fontSize:11, color:"#64748b" }}>Real tool calls · Local or Cloud LLM</div>
              </div>
            </div>

            {/* Provider + model selectors */}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <select value={provider} onChange={e => { setProvider(e.target.value); setModel(""); }}
                style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, color:"#e2e8f0", padding:"6px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
                <option value="ollama">🦙 Ollama</option>
                <option value="anthropic">🤖 Anthropic</option>
              </select>
              <select value={model} onChange={e => setModel(e.target.value)}
                style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, color:"#e2e8f0", padding:"6px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
                <option value="">default</option>
                {PROVIDER_MODELS[provider].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── Status bar ── */}
          <StatusBar provider={provider} statuses={statuses} onCheck={checkStatuses} />

          {/* Not ready banner */}
          {!allReady && statuses.backend !== "unknown" && (
            <div style={{
              marginTop: 8, padding: "8px 14px", borderRadius: 8, fontSize: 12,
              background: "#1a0a00", border: "1px solid #92400e", color: "#fbbf24",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              ⚠️ {statuses.backend !== "ok"
                ? "Backend is not running. Start it with: uvicorn backend:app --reload --port 8000"
                : provider === "ollama"
                  ? "Ollama is not running. Start it with: ollama serve"
                  : "Anthropic API key not detected. Set ANTHROPIC_API_KEY env var and restart backend."}
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 0" }}>
          {messages.length === 0 && (
            <div style={{ textAlign:"center", padding:"50px 0", animation:"fadeIn 0.5s ease" }}>
              <div style={{ fontSize:42, marginBottom:12 }}>🔗</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:700, marginBottom:6 }}>
                {allReady ? "Ready! Try a query below" : "Waiting for services..."}
              </div>
              <div style={{ color:"#64748b", fontSize:13, marginBottom:24 }}>
                {allReady ? "All services are running." : "Check the status bar above."}
              </div>
              {allReady && (
                <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} className="pill" onClick={() => handleSubmit(ex)} style={{
                      background:"#0f172a", border:"1px solid #1e293b", borderRadius:99,
                      color:"#94a3b8", padding:"8px 20px", fontSize:13, cursor:"pointer", transition:"all 0.2s",
                    }}>{ex}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom:20, animation:"fadeIn 0.3s ease" }}>
              {msg.role === "user" ? (
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <div style={{ background:"linear-gradient(135deg,#1d4ed8,#2563eb)", borderRadius:"16px 16px 4px 16px", padding:"12px 18px", maxWidth:"75%", fontSize:14, lineHeight:1.6 }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:"#0f172a", border:"1px solid #334155", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🤖</div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                    {msg.steps.map((step, si) => <StepCard key={si} step={step} />)}
                    {msg.streaming && msg.steps.length === 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, color:"#64748b", fontSize:13 }}>
                        <div style={{ width:13, height:13, border:"2px solid #334155", borderTopColor:"#3b82f6", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                        Connecting to agent...
                      </div>
                    )}
                    {msg.answer && (
                      <div style={{ background:"#0a0f1e", border:"1px solid #1e3a5f", borderRadius:10, padding:"14px 16px", fontSize:14, lineHeight:1.7 }}>
                        {msg.answer}
                        {msg.streaming && <span style={{ display:"inline-block", width:2, height:"1em", background:"#60a5fa", marginLeft:2, verticalAlign:"text-bottom", animation:"blink 0.7s infinite" }} />}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ padding:"12px 0 18px", borderTop:"1px solid #1e293b", flexShrink:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:"10px 10px 10px 16px" }}>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
              onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSubmit();}}}
              placeholder={allReady ? "Ask the agent... (Shift+Enter for newline)" : "Waiting for services to start..."}
              disabled={running || !allReady}
              rows={1}
              style={{ flex:1, background:"transparent", border:"none", resize:"none", color:"#e2e8f0", fontSize:14, lineHeight:1.6, fontFamily:"'Inter',sans-serif", minHeight:24, maxHeight:120, outline:"none", opacity: allReady ? 1 : 0.5 }}
            />
            <button className="send" onClick={() => handleSubmit()} disabled={running || !input.trim() || !allReady}
              style={{ width:34, height:34, borderRadius:8, border:"none", background:"#2563eb", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0, transition:"background 0.2s" }}>
              {running
                ? <div style={{ width:13, height:13, border:"2px solid #ffffff44", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}