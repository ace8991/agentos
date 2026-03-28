import { Link2, Settings2 } from 'lucide-react';
import type { ConnectorState } from '@/lib/connectors';
import ConnectorLogo from './ConnectorLogo';

interface ConnectorQuickAccessProps {
  connectors: ConnectorState[];
  onSelect: (connectorId: string) => void;
  onOpenDirectory?: () => void;
  onOpenSettings?: () => void;
  compact?: boolean;
}

const QUICK_ACCESS_CONNECTOR_IDS = [
  'github',
  'canva',
  'slack',
  'google-drive',
  'notion',
  'telegram',
  'whatsapp',
  'jira',
  'linear',
  'discord',
] as const;

const ConnectorQuickAccess = ({
  connectors,
  onSelect,
  onOpenDirectory,
  onOpenSettings,
  compact = false,
}: ConnectorQuickAccessProps) => {
  const connectorPriority = (connector: ConnectorState) => {
    if (connector.connected) return 0;
    if (connector.configured) return 1;
    return 2;
  };

  const connectorMap = new Map(connectors.map((connector) => [connector.id, connector]));
  const visibleConnectors = QUICK_ACCESS_CONNECTOR_IDS
    .map((id, index) => {
      const connector = connectorMap.get(id);
      return connector ? { connector, index } : null;
    })
    .filter((item): item is { connector: ConnectorState; index: number } => item !== null)
    .sort((left, right) => {
      const priorityDiff = connectorPriority(left.connector) - connectorPriority(right.connector);
      if (priorityDiff !== 0) return priorityDiff;
      return left.index - right.index;
    })
    .slice(0, compact ? 5 : 6)
    .map((item) => item.connector);
  const connectedCount = connectors.filter((connector) => connector.connected).length;
  const configuredCount = connectors.filter((connector) => connector.configured && !connector.connected).length;

  return (
    <div className="flex items-center justify-between gap-3 px-1 md:px-2">
      <button
        onClick={() => {
          if (onOpenDirectory) {
            onOpenDirectory();
            return;
          }
          const firstConnector = visibleConnectors[0];
          if (firstConnector) {
            onSelect(firstConnector.id);
          }
        }}
        className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/68">
          <Link2 size={12} />
        </span>
        <span className="truncate">
          {connectedCount > 0
            ? `${connectedCount} tools ready`
            : configuredCount > 0
            ? `${configuredCount} saved locally`
            : 'Connect your tools'}
        </span>
      </button>

      <div className="flex items-center rounded-full border border-white/10 bg-[rgba(10,14,24,0.22)] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {visibleConnectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => onSelect(connector.id)}
            className={`group relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200 overflow-hidden ${
              connector.connected
                ? 'border-emerald-300/18 bg-emerald-400/10 hover:bg-emerald-400/14'
                : connector.configured
                ? 'border-amber-300/18 bg-amber-400/10 hover:bg-amber-400/14'
                : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
            }`}
            title={
              connector.connected
                ? `${connector.name} ${connector.statusLabel.toLowerCase()}`
                : connector.configured
                ? `${connector.name} saved locally`
                : `Connect ${connector.name}`
            }
          >
            <span
              className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                connector.connected
                  ? 'bg-emerald-300'
                  : connector.configured
                  ? 'bg-amber-300'
                  : 'bg-white/18'
              }`}
            />
            <ConnectorLogo
              connectorId={connector.id}
              name={connector.name}
              badge={connector.badge}
              size="sm"
              className="h-6 w-6 rounded-[8px] border-0 bg-transparent transition-transform duration-200 group-hover:scale-[1.04]"
            />
          </button>
        ))}
        {onOpenSettings && (
          <>
            <div className="mx-1 h-5 w-px bg-white/8" />
            <button
              onClick={onOpenSettings}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
              title="Open connector settings"
            >
              <Settings2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectorQuickAccess;
