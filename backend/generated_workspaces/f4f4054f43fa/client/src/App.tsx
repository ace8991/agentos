import { ArrowRight, FolderTree, MonitorPlay, Sparkles } from 'lucide-react';

const features = [
  'React + Vite + TypeScript scaffold',
  'Tailwind CSS and builder-ready UI tokens',
  'Preview, Code, Database, and Files surfaces',
];

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(93,146,255,0.18),transparent_24%),linear-gradient(180deg,#11192a_0%,#07090f_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-3.5 rounded-md bg-gradient-to-br from-sky-400 to-violet-500" />
            <span className="text-sm font-medium">AgentOS Builder</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5" />
            App workspace
          </div>
        </header>
        <main className="flex flex-1 flex-col justify-center py-16">
          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                Modern builder output
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">Devloper Une Application De</h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/70 md:text-lg">
                Generated from the request: Devloper Une Application De is ready as a structured builder workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950">
                  Open preview
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/78">
                  <FolderTree className="h-4 w-4" />
                  Inspect code
                </button>
              </div>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="rounded-3xl border border-white/10 bg-[#0d1524]/88 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Preview contract</p>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  This generated starter follows a Lovable-style contract: React, Vite, TypeScript, Tailwind CSS, and separate workspace surfaces for preview, code, database, and files.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-4 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <MonitorPlay className="h-5 w-5 text-sky-200" />
                <h2 className="mt-5 text-xl font-medium tracking-tight">{feature}</h2>
                <p className="mt-3 text-sm leading-7 text-white/68">Designed to plug directly into the AgentOS workspace panel for fast iteration.</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
