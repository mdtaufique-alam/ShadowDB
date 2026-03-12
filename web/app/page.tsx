"use client";

import { useState, useEffect, useRef } from "react";
import {
  Terminal, Search, Shield, Cpu, Activity,
  Database, FileText, ChevronRight, Zap, Brain,
  Layers, Info, BarChart3, Clock, Globe, Terminal as TerminalIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FeedEvent = { id: string; msg: string; type: "success" | "info" | "error" | "warn" };
type SearchResult = { path: string; snippet: string };
type Tab = "scan" | "vector" | "docs" | "inference";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState<"query" | "retrieval" | "ranking" | "synthesis" | null>(null);
  
  const [events, setEvents] = useState<FeedEvent[]>([
    { id: "boot-1", msg: "ShadowDB v0.3.0 (Heavy Edition) online", type: "info" },
    { id: "boot-2", msg: "🦀 Rust Initial Scan: Complete", type: "success" },
    { id: "boot-3", msg: "⚡ Real-time SSE Pipeline: Connected", type: "success" },
  ]);
  
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState({ files: 0, vectors: 0, latency: 0 });
  const [docs, setDocs] = useState<any[]>([]);
  const [vectorSample, setVectorSample] = useState<any[]>([]);
  
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats((s) => ({ ...s, files: data.files, vectors: data.vectors }));
      setDocs(data.docs || []);
      setVectorSample(data.vectorSamples || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchStats();
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'index') {
        const { status, path, msg, stats } = data;
        let emoji = '⚡';
        let eventType: FeedEvent['type'] = 'info';
        switch (status) {
          case 'hashing': emoji = '🔍'; break;
          case 'chunking': emoji = '✂️'; break;
          case 'embedding': emoji = '🧠'; break;
          case 'indexing': emoji = '🗄️'; break;
          case 'success': emoji = '✅'; eventType = 'success'; break;
          case 'error': emoji = '❌'; eventType = 'error'; break;
          case 'skipped': emoji = '⏩'; eventType = 'info'; break;
        }
        addEvent(`${emoji} [${status?.toUpperCase()}] ${path}: ${msg}`, eventType);
        if (stats) {
          setStats((s) => ({ ...s, files: stats.files, vectors: stats.vectors }));
          fetchStats();
        }
      }
    };
    return () => eventSource.close();
  }, []);

  const addEvent = (msg: string, type: FeedEvent["type"] = "info") => {
    setEvents((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].msg === msg) return prev;
      const next = [...prev, { id: Math.random().toString(36), msg, type }];
      return next.slice(-50);
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setAnswer("");
    setSources([]);
    setSearchStage("query");
    addEvent(`🔍 Analyzing context for: "${query}"`, "info");
    const start = Date.now();
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.body) throw new Error("No response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedAnswer = "";
      setSearchStage("retrieval");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.startsWith("METADATA:")) {
          try {
            const metaStr = chunk.split("\n")[0].replace("METADATA:", "");
            const meta = JSON.parse(metaStr);
            setSources(meta.sources || []);
            setSearchStage("synthesis");
            addEvent(`🎯 Found ${meta.sources?.length || 0} relevant fragments`, "success");
            continue;
          } catch (e) {}
        }
        accumulatedAnswer += chunk;
        setAnswer(accumulatedAnswer);
      }
      const latency = Date.now() - start;
      setStats((s) => ({ ...s, latency }));
      addEvent(`🤖 Synthesis complete (${latency}ms)`, "success");
    } catch (err: any) {
      addEvent(`❌ Search failed: ${err.message}`, "error");
    } finally {
      setIsSearching(false);
      setSearchStage(null);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground selection:bg-blue-500/30 flex flex-col font-sans">
      <div className="noise-bg" />
      
      {/* Dynamic Island Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass px-6 py-2.5 rounded-full flex items-center gap-8 shadow-2xl shadow-blue-500/10"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center shrink-0">
              <Shield className="text-background w-4 h-4" />
            </div>
            <span className="font-bold tracking-tighter text-lg leading-none pt-0.5">SHADOW<span className="text-accent">DB</span></span>
          </div>
          

          <div className="h-4 w-[1px] bg-white/10" />
          
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center"><Globe className="w-2.5 h-2.5 text-blue-400"/></div>
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center"><Activity className="w-2.5 h-2.5 text-emerald-400"/></div>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Core Online</span>
             </div>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-6 p-8 pt-28 h-full overflow-hidden">
        
        {/* Left Column: Stats & Fleet */}
        <div className="col-span-3 flex flex-col gap-6 h-full overflow-hidden">
           <PiecesCard title="Knowledge Base" icon={<Database className="w-4 h-4 text-accent"/>}>
              <div className="grid grid-cols-1 gap-4">
                 <BigStat label="Files Indexed" value={stats.files.toLocaleString()} />
                 <BigStat label="Vector Latency" value={stats.latency ? `${stats.latency}ms` : "0.00ms"} />
                 <BigStat label="Active Memory" value={stats.vectors.toLocaleString()} unit="VECTORS" />
              </div>
           </PiecesCard>

           <PiecesCard title="Recent Artifacts" icon={<FileText className="w-4 h-4 text-muted"/>} className="flex-1 min-h-0">
              <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 h-full">
                 {docs.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center opacity-20 italic text-[10px]">
                       No files indexed yet
                    </div>
                 ) : (
                    docs.map((d, i) => (
                      <div 
                        key={i} 
                        onClick={() => setQuery(`Tell me about ${d.path.split('/').pop()}`)}
                        className="group p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer active:scale-[0.98]"
                      >
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-foreground/80 truncate pr-4">{d.path.split('/').pop()}</span>
                            <span className="text-[9px] text-accent font-mono shrink-0">{d.chunks}</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-emerald-500/50"/>
                            <span className="text-[8px] uppercase tracking-widest text-muted">Click to recall</span>
                         </div>
                      </div>
                    ))
                 )}
              </div>
           </PiecesCard>
        </div>

        {/* Center Column: Monolithic Terminal */}
        <div className="col-span-5 h-full overflow-hidden">
           <div className="h-full glass rounded-[32px] flex flex-col overflow-hidden top-lit">
              <div className="px-6 py-4 flex items-center justify-between bg-white/[0.02]">
                 <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                       <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                       <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                       <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-muted ml-2">Recall Terminal</span>
                 </div>
                 <div className="text-[9px] font-mono text-muted/40">SHADOW_ENGINE_ROOT</div>
              </div>
              
              <div ref={feedRef} className="flex-1 p-6 font-mono text-[11px] space-y-2.5 overflow-y-auto custom-scrollbar scroll-smooth bg-black/40">
                {events.map((ev) => (
                  <motion.div 
                    key={ev.id}
                    initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-3 items-start ${ev.type === "success" ? "text-emerald-400" : ev.type === "error" ? "text-red-400" : "text-muted"}`}
                  >
                    <span className="text-[9px] text-white/10 mt-0.5 tabular-nums select-none shrink-0" suppressHydrationWarning>{new Date().toLocaleTimeString("en", { hour12: false })}</span>
                    <ChevronRight className="w-3 h-3 mt-1 opacity-20 shrink-0" />
                    <span className="leading-relaxed tracking-tight break-all">{ev.msg}</span>
                  </motion.div>
                ))}
                <motion.span 
                  animate={{ opacity: [1, 0] }} 
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-1.5 h-3 bg-accent/60 ml-1 translate-y-0.5" 
                />
              </div>
           </div>
        </div>

        {/* Right Column: Neural Research */}
        <div className="col-span-4 h-full flex flex-col gap-6 overflow-hidden">
           <div className="glass rounded-[32px] p-6 top-lit shrink-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30 shadow-inner">
                  <Brain className="w-4 h-4 text-accent" />
                </div>
                <div>
                   <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-accent">Neural Research</h3>
                   <p className="text-[9px] text-muted tracking-tight">Accessing local latent memory Space</p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="relative group">
                 <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                 <input
                   type="text"
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   placeholder="Surface any project knowledge..."
                   className="w-full bg-surface-low border border-border rounded-2xl px-5 py-4 text-xs focus:outline-none focus:border-accent/50 transition-all placeholder:text-muted/30 relative z-10 font-medium pr-12"
                 />
                 <button 
                   type="submit"
                   disabled={isSearching}
                   className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-muted/30 hover:text-accent disabled:opacity-30 transition-colors"
                 >
                   {isSearching ? <Zap className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4" />}
                 </button>
              </form>
              
              <AnimatePresence>
                {isSearching && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: "auto", opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 pt-4 border-t border-border flex justify-between items-center px-2"
                  >
                     <SearchingIndicator stage={searchStage} />
                     <div className="text-[9px] font-mono text-accent animate-pulse">THINKING...</div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>

           <div className="flex-1 glass rounded-[32px] p-8 overflow-hidden flex flex-col top-lit shadow-2xl">
              <AnimatePresence mode="wait">
                 {(answer !== null) ? (
                    <motion.div 
                       key="answer"
                       initial={{ opacity: 0, scale: 0.98 }} 
                       animate={{ opacity: 1, scale: 1 }} 
                       className="h-full flex flex-col gap-6 overflow-hidden"
                    >
                       <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                          <div className="text-[14px] leading-relaxed text-foreground font-medium whitespace-pre-wrap break-words opacity-95 selection:bg-accent/40 selection:text-white pb-8">
                             {answer}
                          </div>
                          
                          {sources.length > 0 && (
                            <div className="space-y-4 pt-8 border-t border-border">
                               <h4 className="text-[9px] uppercase font-bold tracking-[0.2em] text-muted flex items-center gap-2 mb-4">
                                 <BarChart3 className="w-3 h-3" /> Grounded Fragments ({sources.length})
                               </h4>
                               <div className="grid grid-cols-1 gap-2.5">
                                 {sources.map((src, i) => (
                                   <div key={i} className="group p-4 bg-white/[0.02] border border-border rounded-2xl hover:bg-white/[0.04] transition-all cursor-default relative overflow-hidden">
                                      <div className="absolute inset-y-0 left-0 w-[1px] bg-accent/0 group-hover:bg-accent transition-all duration-300"/>
                                      <div className="text-[9px] font-bold text-accent mb-1.5 flex items-center gap-2">
                                        <FileText className="w-2.5 h-2.5" /> {src.path.split('/').pop()}
                                      </div>
                                      <p className="text-[10px] text-muted leading-relaxed line-clamp-2 italic">{src.snippet}</p>
                                   </div>
                                 ))}
                               </div>
                            </div>
                          )}
                       </div>
                    </motion.div>
                 ) : !isSearching && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                       <Shield className="w-12 h-12 mb-6 opacity-10" />
                       <div className="max-w-[200px]">
                          <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2">Passive Watch</h4>
                          <p className="text-[9px] leading-relaxed">System is observing filesystem changes. Initiate a neural query to trigger recall.</p>
                       </div>
                    </div>
                 )}
              </AnimatePresence>
           </div>
        </div>
      </main>
    </div>
  );
}

function HeaderNavLink({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all relative ${active ? 'text-foreground' : 'text-muted hover:text-foreground hover:bg-white/5'}`}
    >
      {active && <motion.div layoutId="header-nav" className="absolute inset-0 bg-white/10 rounded-full" />}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function PiecesCard({ title, icon, children, className = "" }: { title: string, icon: any, children: React.ReactNode, className?: string }) {
  return (
    <div className={`glass rounded-[32px] p-6 top-lit overflow-hidden flex flex-col ${className}`}>
       <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-surface-high flex items-center justify-center border border-border">{icon}</div>
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted">{title}</h3>
       </div>
       <div className="flex-1 overflow-hidden min-h-0">
          {children}
       </div>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string, value: string, unit?: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-border group hover:bg-white/[0.04] transition-all">
       <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-2 group-hover:text-accent transition-colors">{label}</div>
       <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {unit && <div className="text-[8px] font-bold text-muted">{unit}</div>}
       </div>
    </div>
  );
}

function SearchingIndicator({ stage }: { stage: string | null }) {
  return (
    <div className="flex gap-1.5">
       <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${stage === 'query' ? 'bg-blue-500 scale-125' : 'bg-white/10'}`} />
       <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${stage === 'retrieval' ? 'bg-blue-500 scale-125' : 'bg-white/10'}`} />
       <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${stage === 'synthesis' ? 'bg-blue-500 scale-125' : 'bg-white/10'}`} />
    </div>
  );
}
