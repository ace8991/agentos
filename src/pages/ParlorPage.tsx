import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Phone, PhoneOff, Loader2, ArrowLeft } from 'lucide-react';
import AudioWaveform from '@/components/parlor/AudioWaveform';
import CameraViewport from '@/components/parlor/CameraViewport';
import { useParlorSession, type ParlorState } from '@/hooks/useParlorSession';

const STATE_LABELS: Record<ParlorState, string> = {
  idle: 'Prêt',
  listening: 'Écoute en cours…',
  processing: 'Réflexion…',
  speaking: 'Réponse…',
};

const STATE_COLORS: Record<ParlorState, string> = {
  idle: 'bg-white/10',
  listening: 'bg-blue-500/20 text-blue-300',
  processing: 'bg-purple-500/20 text-purple-300',
  speaking: 'bg-green-500/20 text-green-300',
};

const ParlorPage = () => {
  const navigate = useNavigate();
  const {
    state,
    transcript,
    stream,
    analyser,
    cameraEnabled,
    error,
    startSession,
    stopSession,
    toggleCamera,
  } = useParlorSession();

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isActive = state !== 'idle';

  return (
    <div className="flex flex-col h-screen bg-[hsl(0,0%,6%)] text-white overflow-hidden">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Retour"
        >
          <ArrowLeft size={18} />
          <span>Retour</span>
        </button>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Left: Camera + Controls */}
        <div className="flex flex-col gap-4 lg:w-[45%] shrink-0">
          {/* Camera viewport */}
          <CameraViewport
            stream={stream}
            enabled={cameraEnabled}
            onToggle={toggleCamera}
            aiActive={state === 'processing' || state === 'speaking'}
          />

          {/* Audio waveform */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <AudioWaveform analyser={analyser} state={state} />
          </div>

          {/* State indicator */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${STATE_COLORS[state]}`}>
              {state === 'processing' && <Loader2 size={12} className="animate-spin" />}
              {state === 'listening' && <Mic size={12} />}
              {STATE_LABELS[state]}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {!isActive ? (
                <button
                  onClick={startSession}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  <Phone size={16} />
                  Démarrer
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600/80 hover:bg-red-500 text-sm font-medium transition-colors"
                >
                  <PhoneOff size={16} />
                  Terminer
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 text-xs uppercase tracking-widest text-white/40 font-medium">
            Transcript
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
                <MicOff size={32} />
                <p className="text-sm">Appuyez sur Démarrer pour commencer la conversation</p>
              </div>
            )}

            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'bg-blue-600/20 text-blue-100 rounded-br-md'
                      : 'bg-white/[0.06] text-white/80 rounded-bl-md'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">
                    {entry.role === 'user' ? 'Vous' : 'IA'}
                  </span>
                  {entry.text}
                </div>
              </div>
            ))}

            {state === 'processing' && (
              <div className="flex justify-start">
                <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParlorPage;
