import { useEffect, useRef, useState, useCallback } from 'react';
import { Globe, Wifi, WifiOff, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, X, AlertCircle, Sparkles } from 'lucide-react';

interface BrowserFrame {
  type: 'frame' | 'idle' | 'error';
  screenshot_b64?: string;
  url?: string;
  title?: string;
  reasoning?: string;
  message?: string;
}

interface LiveBrowserViewProps {
  runId: string | null;
  isRunning: boolean;
  currentReasoning?: string;
  onClose?: () => void;
}

const WS_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace('http://', 'ws://').replace('https://', 'wss://');

const LiveBrowserView = ({ runId, isRunning, currentReasoning, onClose }: LiveBrowserViewProps) => {
  const [frame, setFrame] = useState<BrowserFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const connect = useCallback(() => {
    if (!runId || !isRunning) return;
    wsRef.current?.close();
    const ws = new WebSocket(`${WS_BASE}/browser/stream/${runId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      if (isRunning) reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data: BrowserFrame = JSON.parse(e.data);
        setFrame(data);
        if (data.type === 'frame' && data.screenshot_b64 && imgRef.current) {
          imgRef.current.src = `data:image/jpeg;base64,${data.screenshot_b64}`;
        }
      } catch {}
    };
  }, [runId, isRunning]);

  useEffect(() => {
    if (runId && isRunning) connect();
    else { wsRef.current?.close(); setConnected(false); setFrame(null); }
    return () => { wsRef.current?.close(); if (reconnectRef.current) clearTimeout(reconnectRef.current); };
  }, [runId, isRunning, connect]);

  const hasFrame = frame?.type === 'frame' && frame.screenshot_b64;
  const displayUrl = frame?.url || '';
  const displayTitle = frame?.title || '';
  const reasoning = currentReasoning || frame?.reasoning || '';
  const hostname = displayUrl ? (() => { try { return new URL(displayUrl).hostname; } catch { return ''; } })() : '';
  const faviconUrl = hostname ? `https://www.google.com/s2/favicons?sz=16&domain=${hostname}` : null;
  const urlShort = displayUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40);

  if (!isRunning && !hasFrame) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground h-full">
        <Globe size={28} strokeWidth={1.5} />
        <span className="text-xs">Browser appears when agent navigates</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0e0e16] rounded-lg overflow-hidden border border-border/40">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-2.5 py-2 bg-[#141420] border-b border-white/[0.06]">
        <button className="text-muted-foreground/30" disabled><ChevronLeft size={13} /></button>
        <button className="text-muted-foreground/30" disabled><ChevronRight size={13} /></button>
        <button className="text-muted-foreground/40 hover:text-muted-foreground p-0.5"><RefreshCw size={11} /></button>
        <div className="flex-1 flex items-center gap-1.5 bg-[#1a1a2e] border border-white/[0.07] rounded-md px-2 py-1">
          {faviconUrl ? <img src={faviconUrl} alt="" className="w-3 h-3 shrink-0 opacity-75" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} /> : <Globe size={10} className="text-muted-foreground/40 shrink-0" />}
          <span className="text-[11px] text-muted-foreground font-mono flex-1 truncate">{urlShort || (isRunning ? 'Connecting...' : '—')}</span>
          {displayUrl && <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/30 hover:text-muted-foreground ml-1 shrink-0"><ExternalLink size={9} /></a>}
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-red-400' : 'bg-muted-foreground/40'}`} style={connected ? {animation:'pulse 1s ease-in-out infinite'} : {}} />
          <span className="text-[9px] font-bold text-red-400 tracking-widest">LIVE</span>
        </div>
        <div className={connected ? 'text-green-400' : 'text-muted-foreground/30'}>{connected ? <Wifi size={11}/> : <WifiOff size={11}/>}</div>
        {onClose && <button onClick={onClose} className="text-muted-foreground/30 hover:text-muted-foreground"><X size={12}/></button>}
      </div>

      {/* Screen */}
      <div className="relative flex-1 overflow-hidden bg-white">
        <img ref={imgRef} alt="Live browser" className="w-full h-full object-contain" style={{display: hasFrame ? 'block' : 'none'}} />
        {!hasFrame && isRunning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0e0e16]">
            <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
            <span className="text-xs text-muted-foreground">Opening browser...</span>
          </div>
        )}
        {/* AI reasoning bubble */}
        {reasoning && showReasoning && (
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <div className="bg-[#1a1a2e]/95 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2.5 shadow-xl">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={10} className="text-primary"/>
                </div>
                <p className="text-[11px] text-foreground/90 leading-relaxed flex-1">{reasoning}</p>
                <button onClick={() => setShowReasoning(false)} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5"><X size={10}/></button>
              </div>
            </div>
          </div>
        )}
        {reasoning && !showReasoning && (
          <button onClick={() => setShowReasoning(true)} className="absolute bottom-3 right-3 z-20 w-7 h-7 rounded-full bg-[#1a1a2e]/90 border border-white/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
            <Sparkles size={11}/>
          </button>
        )}
        {frame?.type === 'error' && (
          <div className="absolute top-3 left-3 right-3 z-20">
            <div className="bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle size={11} className="text-destructive shrink-0"/>
              <span className="text-[11px] text-destructive">{frame.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Title bar */}
      {displayTitle && (
        <div className="px-3 py-1 bg-[#141420] border-t border-white/[0.05] flex items-center gap-1.5">
          {faviconUrl && <img src={faviconUrl} alt="" className="w-3 h-3 opacity-50" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>}
          <span className="text-[10px] text-muted-foreground truncate">{displayTitle}</span>
        </div>
      )}
    </div>
  );
};

export default LiveBrowserView;
