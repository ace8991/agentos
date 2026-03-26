import { Link2, Settings2 } from 'lucide-react';
import type { ConnectorState } from '@/lib/connectors';

interface ConnectorQuickAccessProps {
  connectors: ConnectorState[];
  onSelect: (connectorId: string) => void;
  onOpenSettings?: () => void;
  compact?: boolean;
}

const ConnectorQuickAccess = ({
  connectors,
  onSelect,
  onOpenSettings,
  compact = false,
}: ConnectorQuickAccessProps) => {
  const visibleConnectors = connectors.slice(0, compact ? 5 : 6);
  const connectedCount = connectors.filter((connector) => connector.connected).length;

  return (
    <div className="flex items-center justify-between gap-3 px-1 md:px-2">
      <button
        onClick={() => {
          if (onOpenSettings) {
            onOpenSettings();
            return;
          }
          const firstConnector = visibleConnectors[0];
          if (firstConnector) {
            onSelect(firstConnector.id);
          }
        }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Link2 size={13} />
        <span>{connectedCount > 0 ? `${connectedCount} tools connected` : 'Connect your tools'}</span>
      </button>

      <div className="flex items-center gap-1.5">
        {visibleConnectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => onSelect(connector.id)}
            className={`h-7 min-w-7 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
              connector.connected
                ? 'border-success/30 bg-success/10 text-success hover:bg-success/15'
                : 'border-border bg-card/60 text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
            }`}
            title={connector.connected ? `${connector.name} connected` : `Connect ${connector.name}`}
          >
            {connector.badge}
          </button>
        ))}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="h-7 w-7 rounded-lg border border-border bg-card/60 text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors flex items-center justify-center"
            title="Open connector settings"
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectorQuickAccess;
