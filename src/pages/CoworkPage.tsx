import { useState } from 'react';
import { ChevronDown, FolderOpen, Plus, ArrowRight, Check, Download, Wrench, CalendarClock, FileCode2 } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
}

const sampleFiles = [
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
];

const defaultChecklist: ChecklistItem[] = [
  { id: 'download', label: 'Télécharger Cowork', description: 'Bienvenue !', done: true },
  { id: 'connect-tools', label: 'Connectez vos outils quotidiens', description: 'Plus Claude connaît votre configuration, plus il peut en faire', done: false },
  { id: 'create-something', label: 'Demandez à Claude de créer quelque chose.', description: 'Essayez un tableur, un document ou une présentation', done: false },
  { id: 'schedule-task', label: 'Planifier une tâche récurrente', description: 'Idéal pour les rappels, rapports ou suivis réguliers', done: false },
];

const CoworkPage = () => {
  const [input, setInput] = useState('');
  const [checklist, setChecklist] = useState(defaultChecklist);

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1a1a1a]">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Scrollable main */}
        <div className="flex-1 overflow-y-auto px-3.5 py-6 sm:px-8 sm:py-10 flex flex-col items-center" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Hero */}
          <div className="text-center mb-[18px] w-full max-w-[680px]">
            <div className="flex items-center justify-center gap-2.5 mb-1.5 flex-wrap">
              <span className="text-[26px] text-[#e05a2b]">✳</span>
              <h1 className="text-[19px] sm:text-[23px] font-bold text-[#e8e8e8] tracking-tight leading-tight">
                Accomplissons une tâche de votre liste
              </h1>
            </div>
            <p className="text-xs text-[#666] mt-[5px] leading-relaxed">
              Cowork est en aperçu de recherche. <a href="#" className="text-[#888] underline cursor-pointer">Découvrez comment l'utiliser en toute sécurité.</a>
            </p>
          </div>

          {/* File cards strip */}
          <div className="flex gap-[9px] w-full max-w-[740px] overflow-x-auto mb-4 pb-1.5 scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
            {sampleFiles.map((file, i) => (
              <button
                key={i}
                className="flex-shrink-0 min-w-[115px] max-w-[125px] bg-[#252525] border border-[#333] rounded-lg p-[11px_10px_9px] text-left cursor-pointer active:bg-[#2a2a2a]"
              >
                <p className="text-[10px] text-[#777] leading-[1.4] break-all mb-[9px]">{file.path}</p>
                <span className="inline-block text-[10px] font-bold px-[5px] py-[2px] rounded-[3px] bg-[#2a3a50] text-[#6aa3d4]">{file.type}</span>
              </button>
            ))}
          </div>

          {/* Input box */}
          <div className="bg-[#252525] border border-[#333] rounded-xl px-3.5 py-[13px] w-full max-w-[680px] mb-[18px]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que souhaitez-vous accomplir ?"
              className="w-full bg-transparent border-none outline-none text-[#777] text-[15px] placeholder:text-[#555]"
            />
            <div className="flex items-center justify-between mt-[11px] gap-1.5">
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <button className="flex items-center gap-[5px] bg-transparent border-none text-[#777] text-[12.5px] cursor-pointer px-1 py-[5px] rounded-md whitespace-nowrap overflow-hidden">
                  <FolderOpen size={14} className="flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis hidden min-[381px]:inline">Travailler dans un projet</span>
                  <ChevronDown size={12} className="flex-shrink-0" />
                </button>
                <button className="bg-transparent border-none text-[#555] cursor-pointer px-1.5 py-1 text-lg leading-none flex-shrink-0">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button className="flex items-center gap-1 bg-transparent border-none text-[#888] text-[12.5px] cursor-pointer whitespace-nowrap">
                  Sonnet 4.6 <ChevronDown size={12} />
                </button>
                <button className="bg-[#e05a2b] text-white border-none rounded-lg py-[9px] px-3.5 text-[13px] font-semibold cursor-pointer flex items-center gap-[5px] whitespace-nowrap active:bg-[#c04518]">
                  C'est parti. <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Discover section */}
          <div className="w-full max-w-[680px]">
            <h2 className="text-[15px] font-semibold text-[#bbb] mb-3">Découvrez Cowork.</h2>
            {checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-[13px] border-b border-[#252525] last:border-b-0 cursor-pointer"
                onClick={() => toggleItem(item.id)}
              >
                <div className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 mt-[1px] ${
                  item.done ? 'bg-[#555] border-[#555]' : 'border-[#444]'
                }`}>
                  {item.done && <Check size={12} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] font-medium ${
                    item.done ? 'text-[#999] line-through' : 'text-[#ccc]'
                  }`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-[#666] mt-[3px] leading-[1.45]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoworkPage;
