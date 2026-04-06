import { useState } from 'react';
import { GitBranch, FolderOpen, Check, ChevronDown, Mic, Monitor } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import HexLogo from '@/components/HexLogo';

const CodePage = () => {
  const [autoAccept, setAutoAccept] = useState(true);
  const [input, setInput] = useState('');
  const [selectedRepo] = useState('Alexis863/eduayiti');
  const [selectedBranch] = useState('Sélectionner une branche');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1a1a1a]">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main area - empty centered */}
        <div className="flex-1 flex items-center justify-center bg-[#1a1a1a]">
          <HexLogo size={48} />
        </div>

        {/* Bottom section */}
        <div className="flex-shrink-0 bg-[#1a1a1a] px-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2.5">
          {/* Input wrapper */}
          <div className="bg-[#252525] border border-[#333] rounded-xl px-3.5 py-3 mb-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nouvelle tâche..."
              className="w-full bg-transparent border-none outline-none text-[#888] text-[15px] placeholder:text-[#555]"
            />
            <div className="flex items-center justify-between mt-2.5 gap-1">
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                <button className="flex items-center gap-1 bg-transparent border-none text-[#666] text-[11.5px] cursor-pointer px-1.5 py-1 rounded-md">
                  <FolderOpen size={13} className="flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">Travailler dans un projet</span>
                  <ChevronDown size={12} className="flex-shrink-0" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <label
                  className="flex items-center gap-1.5 cursor-pointer text-[#666] text-[11.5px] select-none"
                  onClick={() => setAutoAccept(!autoAccept)}
                >
                  <div className={`h-3.5 w-3.5 rounded-sm flex items-center justify-center flex-shrink-0 ${
                    autoAccept ? 'bg-[#4caf6e]' : 'border border-[#444] bg-transparent'
                  }`}>
                    {autoAccept && <Check size={9} className="text-white" />}
                  </div>
                  <span className="whitespace-nowrap hidden sm:inline">Accepter automatiquement les modifications</span>
                </label>
                <button className="flex items-center gap-1 bg-transparent border-none text-[#888] text-[12.5px] cursor-pointer px-1 py-1 rounded whitespace-nowrap">
                  Opus 4.6 <ChevronDown size={12} />
                </button>
                <button className="bg-transparent border-none text-[#666] cursor-pointer p-1.5 rounded-md flex items-center">
                  <Mic size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#888] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              <FolderOpen size={13} />
              {selectedRepo}
            </button>
            <button className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#777] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              <GitBranch size={12} />
              {selectedBranch}
            </button>
            <button className="flex items-center gap-[5px] bg-[#1e3a2a] border border-[#2a4a36] text-[#5cb87a] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              <div className="w-[15px] h-[15px] bg-[#4caf6e] rounded-[3px] flex items-center justify-center flex-shrink-0">
                <Check size={10} className="text-white" />
              </div>
              worktree
            </button>
            <button className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#888] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap ml-auto">
              <Monitor size={12} />
              Local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePage;
