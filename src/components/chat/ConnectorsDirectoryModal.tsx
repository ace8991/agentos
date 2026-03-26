import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, Settings2, X } from 'lucide-react';
import {
  CONNECTOR_DEFINITIONS,
  getConnectorDefinition,
  type ConnectorState,
} from '@/lib/connectors';

interface ConnectorsDirectoryModalProps {
  open: boolean;
  connectors: ConnectorState[];
  onClose: () => void;
  onSelectConnector: (connectorId: string) => void;
  onOpenSettings?: () => void;
}

const sortOptions = [
  { id: 'popular', label: 'Most popular' },
  { id: 'alphabetical', label: 'A to Z' },
  { id: 'connected', label: 'Connected first' },
] as const;

type SortOption = (typeof sortOptions)[number]['id'];

const ConnectorsDirectoryModal = ({
  open,
  connectors,
  onClose,
  onSelectConnector,
  onOpenSettings,
}: ConnectorsDirectoryModalProps) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [categoryFilter, setCategoryFilter] = useState('All categories');

  const connectorStateMap = useMemo(
    () => new Map(connectors.map((connector) => [connector.id, connector])),
    [connectors],
  );

  const typeOptions = useMemo(
    () => ['All types', ...Array.from(new Set(CONNECTOR_DEFINITIONS.map((connector) => connector.type)))],
    [],
  );
  const categoryOptions = useMemo(
    () => ['All categories', ...Array.from(new Set(CONNECTOR_DEFINITIONS.map((connector) => connector.category)))],
    [],
  );

  const visibleConnectors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = CONNECTOR_DEFINITIONS.filter((connector) => {
      const matchesSearch =
        !normalizedSearch ||
        connector.name.toLowerCase().includes(normalizedSearch) ||
        connector.description.toLowerCase().includes(normalizedSearch) ||
        connector.shortAction.toLowerCase().includes(normalizedSearch) ||
        connector.category.toLowerCase().includes(normalizedSearch);
      const matchesType = typeFilter === 'All types' || connector.type === typeFilter;
      const matchesCategory = categoryFilter === 'All categories' || connector.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });

    return filtered.sort((left, right) => {
      const leftState = connectorStateMap.get(left.id);
      const rightState = connectorStateMap.get(right.id);

      if (sortBy === 'connected') {
        if (leftState?.connected !== rightState?.connected) {
          return leftState?.connected ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      }

      if (sortBy === 'alphabetical') {
        return left.name.localeCompare(right.name);
      }

      return (left.popularityRank ?? 999) - (right.popularityRank ?? 999);
    });
  }, [categoryFilter, connectorStateMap, search, sortBy, typeFilter]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/55 px-3 py-4" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[92vh] rounded-[28px] border border-border bg-[#2b2924]/95 text-foreground shadow-2xl backdrop-blur-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-white/10">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-[40px] leading-none font-semibold tracking-tight text-stone-100">
              Connecteurs
            </h2>
            <p className="mt-3 text-sm md:text-base text-stone-300 leading-relaxed">
              Connectez AgentOS a vos applications, fichiers et services. Choisissez un connecteur,
              puis configurez ses credentials dans l&apos;etape suivante.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-1 text-stone-400 hover:text-white transition-colors p-1"
            title="Close connectors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-6 md:px-8 pt-5 pb-4 border-b border-white/10">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher"
                className="w-full h-11 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <SelectPill value={sortBy} options={sortOptions.map((option) => option.id)} labels={Object.fromEntries(sortOptions.map((option) => [option.id, option.label]))} onChange={(value) => setSortBy(value as SortOption)} />
            <SelectPill value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
            <SelectPill value={categoryFilter} options={categoryOptions} onChange={setCategoryFilter} />
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-stone-200 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Settings2 size={15} />
                Settings
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-210px)] px-6 md:px-8 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleConnectors.map((connector) => {
              const state = connectorStateMap.get(connector.id);
              const isConnected = Boolean(state?.connected);
              const config = getConnectorDefinition(connector.id);

              return (
                <button
                  key={connector.id}
                  onClick={() => onSelectConnector(connector.id)}
                  className="w-full text-left rounded-[26px] border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-5 flex items-start gap-4 group"
                >
                  <div className="h-14 w-14 rounded-2xl border border-white/10 bg-black/15 flex items-center justify-center text-lg font-semibold text-stone-100 shrink-0">
                    {connector.badge}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl leading-none font-semibold text-stone-100">{connector.name}</h3>
                      {connector.popularityRank && (
                        <span className="text-sm text-stone-400">#{connector.popularityRank} populaire</span>
                      )}
                      {connector.providerLabel && (
                        <span className="text-sm text-stone-400">{connector.providerLabel}</span>
                      )}
                    </div>
                    <p className="mt-2 text-[15px] leading-6 text-stone-300">
                      {config?.shortAction ?? connector.name}
                    </p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-stone-300">
                        {connector.type}
                      </span>
                      {config?.category && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-stone-300">
                          {config.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isConnected ? (
                      <div className="h-11 w-11 rounded-2xl border border-success/25 bg-success/10 text-success flex items-center justify-center">
                        <Check size={18} />
                      </div>
                    ) : (
                      <div className="h-11 w-11 rounded-2xl border border-white/10 bg-white/[0.04] text-stone-200 flex items-center justify-center group-hover:bg-white/[0.08]">
                        <Plus size={18} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {visibleConnectors.length === 0 && (
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-8 text-center text-stone-300">
              Aucun connecteur ne correspond a cette recherche.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SelectPill = ({
  value,
  options,
  onChange,
  labels,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="appearance-none h-11 rounded-xl border border-white/10 bg-white/5 pl-4 pr-10 text-sm text-stone-200 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-[150px]"
    >
      {options.map((option) => (
        <option key={option} value={option} className="text-black">
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
  </div>
);

export default ConnectorsDirectoryModal;
