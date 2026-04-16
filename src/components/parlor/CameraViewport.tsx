import { useEffect, useRef } from 'react';
import { Video, VideoOff } from 'lucide-react';

interface CameraViewportProps {
  stream: MediaStream | null;
  enabled: boolean;
  onToggle: () => void;
  aiActive: boolean;
}

const CameraViewport = ({ stream, enabled, onToggle, aiActive }: CameraViewportProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative group">
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all duration-700 ${
          aiActive
            ? 'border-purple-500/60 shadow-[0_0_40px_rgba(168,85,247,0.25)]'
            : 'border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]'
        }`}
      >
        {enabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video object-cover bg-black/80"
          />
        ) : (
          <div className="w-full aspect-video bg-black/60 flex items-center justify-center">
            <VideoOff className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Glow overlay when AI is active */}
        {aiActive && (
          <div className="absolute inset-0 pointer-events-none rounded-2xl animate-pulse"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 70%)',
            }}
          />
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`absolute bottom-3 right-3 p-2.5 rounded-xl backdrop-blur-xl transition-all ${
          enabled
            ? 'bg-white/10 text-white/80 hover:bg-white/20'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
      >
        {enabled ? <Video size={18} /> : <VideoOff size={18} />}
      </button>

      {/* On-device indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xl text-[10px] uppercase tracking-widest text-white/50">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
        On-device
      </div>
    </div>
  );
};

export default CameraViewport;
