import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, Mic, Plus, User } from 'lucide-react';
import HexLogo from '@/components/HexLogo';
import { useStore } from '@/store/useStore';

const navItems = ['Home', 'Features', 'Pricing', 'Docs', 'Contact'];

const Welcome = () => {
  const [taskInput, setTaskInput] = useState('');
  const setTask = useStore((s) => s.setTask);
  const navigate = useNavigate();

  const handleStart = () => {
    if (!taskInput.trim()) return;
    setTask(taskInput.trim());
    navigate('/dashboard');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/hero-bg.png)' }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-10 py-5">
          <div className="flex items-center gap-2.5">
            <HexLogo size={28} />
            <span className="text-xl font-medium tracking-tight text-white">AgentOS</span>
          </div>
          <div className="flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-white/80 hover:text-white transition-colors font-medium"
              >
                {item}
              </a>
            ))}
            <button className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all active:scale-95">
              <User size={16} />
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-12">
          <h1
            className="text-5xl font-medium text-white text-center leading-tight mb-4"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
          >
            Automate everything.
            <br />
            Your agent handles the rest.
          </h1>
          <p
            className="text-lg text-white/70 text-center mb-12"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
          >
            AI agent that automates tasks on your computer.
          </p>

          {/* Task input bar */}
          <div className="w-full max-w-2xl relative group">
            {/* Glow border */}
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-secondary via-primary/40 to-primary opacity-60 group-focus-within:opacity-100 transition-opacity blur-[1px]" />
            <div className="relative flex items-center bg-[#12121A]/90 backdrop-blur-md rounded-xl border border-white/10 px-4 py-3 gap-3">
              <button className="shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/15 transition-all active:scale-95">
                <Plus size={16} />
              </button>
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what the agent should do..."
                className="flex-1 bg-transparent text-white placeholder:text-white/40 text-sm focus:outline-none"
              />
              <button className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-1.5">
                <Mic size={18} />
              </button>
              <button
                onClick={handleStart}
                disabled={!taskInput.trim()}
                className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 py-2 rounded-lg transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
              >
                Start Agent
              </button>
            </div>
            {/* Animated dots under input */}
            <div className="flex justify-center gap-2 mt-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-secondary/60"
                  style={{
                    animation: `pulse-dot 2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-16" />
      </div>
    </div>
  );
};

export default Welcome;
