import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, Settings2, X } from 'lucide-react';
import {
  CONNECTOR_DEFINITIONS,
  getConnectorDefinition,
  type ConnectorState,
} from '@/lib/connectors';
import ConnectorLogo from './ConnectorLogo';

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
        className="w-full max-w-[940px] max-h-[92vh] rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,#37342d_0%,#2a2824_40%,#211f1b_100%)] text-foreground shadow-2xl backdrop-blur-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 md:px-7 pt-5 md:pt-6 pb-4 border-b border-white/10">
          <div className="max-w-2xl">
            <h2 className="text-[34px] md:text-[42px] leading-none font-semibold tracking-tight text-stone-100">
              Connecteurs
            </h2>
            <p className="mt-2 text-sm md:text-[15px] text-stone-300 leading-relaxed">
              Connectez AgentOS a vos applications, fichiers et services. Choisissez un connecteur,
              puis configurez ses credentials dans l&apos;etape suivante.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-stone-400">
              <span>{connectors.filter((connector) => connector.connected).length} connectes</span>
              <span>{CONNECTOR_DEFINITIONS.length} integrations disponibles</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 text-stone-400 hover:text-white transition-colors p-1"
            title="Close connectors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 md:px-7 pt-4 pb-4 border-b border-white/10">
          <div className="flex flex-col md:flex-row md:flex-wrap gap-2.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher"
                className="w-full h-10 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <SelectPill value={sortBy} options={sortOptions.map((option) => option.id)} labels={Object.fromEntries(sortOptions.map((option) => [option.id, option.label]))} onChange={(value) => setSortBy(value as SortOption)} />
            <SelectPill value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
            <SelectPill value={categoryFilter} options={categoryOptions} onChange={setCategoryFilter} />
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-stone-200 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Settings2 size={15} />
                Settings
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-188px)] px-5 md:px-7 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleConnectors.map((connector) => {
              const state = connectorStateMap.get(connector.id);
              const isConnected = Boolean(state?.connected);
              const config = getConnectorDefinition(connector.id);

              return (
                <button
                  key={connector.id}
                  onClick={() => onSelectConnector(connector.id)}
                  className="w-full text-left rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] transition-all duration-200 px-4 py-3.5 flex items-start gap-3 group shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <ConnectorLogo connectorId={connector.id} name={connector.name} badge={connector.badge} size="md" className="bg-black/12" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-[15px] md:text-[16px] leading-none font-semibold text-stone-100 truncate">
                        {connector.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[12px] text-stone-400 whitespace-nowrap">
                        {connector.popularityRank && <span>#{connector.popularityRank}</span>}
                        {connector.providerLabel && <span className="truncate max-w-[92px]">{connector.providerLabel}</span>}
                      </div>
                    </div>
                    <p
                      className="mt-1.5 text-[13px] leading-5 text-stone-300"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {config?.shortAction ?? connector.name}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] uppercase tracking-[0.14em] text-stone-400">
                      <span>{connector.type}</span>
                      {config?.category && (
                        <>
                          <span className="text-stone-500">/</span>
                          <span>{config.category}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isConnected ? (
                      <div className="h-10 w-10 rounded-[18px] border border-success/25 bg-success/10 text-success flex items-center justify-center shadow-[0_0_0_1px_rgba(74,222,128,0.06)]">
                        <Check size={16} />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-[18px] border border-white/10 bg-white/[0.04] text-stone-200 flex items-center justify-center group-hover:bg-white/[0.08]">
                        <Plus size={16} />
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
      className="appearance-none h-10 rounded-xl border border-white/10 bg-white/5 pl-4 pr-10 text-sm text-stone-200 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-[138px]"
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
