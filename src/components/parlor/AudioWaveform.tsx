import { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  state: 'idle' | 'listening' | 'processing' | 'speaking';
}

const STATE_COLORS: Record<string, string> = {
  idle: 'rgba(255,255,255,0.25)',
  listening: 'rgba(59,130,246,0.8)',
  processing: 'rgba(168,85,247,0.7)',
  speaking: 'rgba(34,197,94,0.8)',
};

const AudioWaveform = ({ analyser, state }: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const bufferLength = analyser?.frequencyBinCount ?? 64;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barCount = 48;
      const gap = 3;
      const barWidth = (width - gap * (barCount - 1)) / barCount;
      const color = STATE_COLORS[state] || STATE_COLORS.idle;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = analyser ? dataArray[dataIndex] / 255 : (Math.sin(Date.now() / 600 + i * 0.3) * 0.15 + 0.15);
        const barHeight = Math.max(2, value * height * 0.8);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, state]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded-xl"
      style={{ imageRendering: 'auto' }}
    />
  );
};

export default AudioWaveform;
