import { useEffect, useMemo, useState } from 'react';
import { X, Check, ExternalLink, Key, Globe, Shield } from 'lucide-react';
import {
  clearConnectorValues,
  type ConnectorState,
  getConnectorDefinition,
  hasConnectorCredentials,
  loadConnectors,
  loadConnectorValues,
  saveConnectorValues,
} from '@/lib/connectors';
import { validateConnector, type ConnectorValidationResponse } from '@/lib/api';
import ConnectorLogo from './ConnectorLogo';

interface ConnectorConfigModalProps {
  connectorId: string | null;
  onClose: () => void;
  onSave: (nextState: ConnectorState) => void;
}

const ConnectorConfigModal = ({ connectorId, onClose, onSave }: ConnectorConfigModalProps) => {
  const config = useMemo(
    () => (connectorId ? getConnectorDefinition(connectorId) : null),
    [connectorId],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectorState, setConnectorState] = useState<ConnectorState | null>(null);

  const buildSavedState = (configured: boolean): ConnectorState | null => {
    if (!config) return null;
    const status = configured ? 'saved' : 'not_configured';
    const statusLabel =
      status === 'saved'
        ? 'Saved locally'
        : 'Not configured';
    const statusDetail = configured
      ? config.integrationMode === 'relay'
        ? 'Credentials are saved, but this connector still depends on the inbound relay/webhook bridge.'
        : config.integrationMode === 'local'
        ? 'Configuration is saved locally. This connector only becomes active on a local installation.'
        : config.integrationMode === 'native'
        ? 'Credentials are saved locally. Run live validation to confirm the provider accepts them.'
        : 'Credentials are saved locally, but this catalog entry is not wired to a native runtime yet.'
      : 'No credentials or endpoint details saved yet.';
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      badge: config.badge,
      integrationMode: config.integrationMode,
      configured,
      connected: false,
      status,
      statusLabel,
      statusDetail,
      lastCheckedAt: null,
    };
  };

  const buildValidatedState = (result: ConnectorValidationResponse, configured: boolean): ConnectorState | null => {
    if (!config) return null;
    const labelMap: Record<ConnectorValidationResponse['status'], string> = {
      not_configured: 'Not configured',
      saved: 'Saved locally',
      verified: 'Verified',
      ready_relay: 'Relay ready',
      ready_local: 'Local ready',
      error: 'Needs attention',
    };
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      badge: config.badge,
      integrationMode: result.integration_mode,
      configured,
      connected: result.ready,
      status: result.status,
      statusLabel: labelMap[result.status],
      statusDetail: result.message,
      lastCheckedAt: result.checked_at,
    };
  };

  useEffect(() => {
    if (!config) {
      setValues({});
      setShowFields({});
      setSaved(false);
      setTesting(false);
      setConnectorState(null);
      return;
    }

    setValues(loadConnectorValues(config.id));
    setShowFields({});
    setSaved(false);
    setTesting(false);
    setConnectorState(loadConnectors().find((connector) => connector.id === config.id) ?? null);
  }, [config]);

  if (!config) {
    return null;
  }

  const isConnected = hasConnectorCredentials(config.id, values);

  const handleSave = () => {
    const previousValues = loadConnectorValues(config.id);
    const valuesChanged = JSON.stringify(previousValues) !== JSON.stringify(values);
    saveConnectorValues(config.id, values);
    const nextState =
      !valuesChanged && connectorState
        ? { ...connectorState, configured: isConnected }
        : buildSavedState(isConnected);
    if (nextState) {
      setConnectorState(nextState);
      onSave(nextState);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await validateConnector(config.id, values);
      const nextState = buildValidatedState(result, isConnected);
      if (nextState) {
        setConnectorState(nextState);
        saveConnectorValues(config.id, values);
        onSave(nextState);
      }
    } catch (error) {
      const nextState = config
        ? {
            id: config.id,
            name: config.name,
            type: config.type,
            badge: config.badge,
            integrationMode: config.integrationMode,
            configured: isConnected,
            connected: false,
            status: 'error' as const,
            statusLabel: 'Needs attention',
            statusDetail: error instanceof Error ? error.message : 'Validation failed.',
            lastCheckedAt: new Date().toISOString(),
          }
        : null;
      if (nextState) {
        setConnectorState(nextState);
        onSave(nextState);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearConnectorValues(config.id);
    setValues({});
    const nextState = buildSavedState(false);
    if (nextState) {
      setConnectorState(nextState);
      onSave(nextState);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="glass-modal rounded-xl border border-border w-full max-w-md mx-4 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ConnectorLogo connectorId={config.id} name={config.name} badge={config.badge} size="md" />
            <div>
              <h2 className="text-base font-medium text-foreground">{config.name}</h2>
              <p className="text-xs text-muted-foreground capitalize">{config.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{config.description}</p>

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              connectorState?.connected
                ? 'bg-success/10 text-success border border-success/20'
                : connectorState?.status === 'error'
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : connectorState?.configured
                ? 'bg-warning/10 text-warning border border-warning/20'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectorState?.connected
                  ? 'bg-success'
                  : connectorState?.status === 'error'
                  ? 'bg-destructive'
                  : connectorState?.configured
                  ? 'bg-warning'
                  : 'bg-muted-foreground'
              }`}
            />
            {connectorState?.statusLabel || 'Not configured'}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium uppercase tracking-[0.14em] text-[10px] text-muted-foreground/90">
                {config.integrationMode} flow
              </span>
              {connectorState?.lastCheckedAt && (
                <span>
                  Checked {new Date(connectorState.lastCheckedAt).toLocaleString()}
                </span>
              )}
            </div>
            <p className="mt-1.5 leading-relaxed">
              {connectorState?.statusDetail || 'Save credentials locally, then validate to confirm the real provider state.'}
            </p>
          </div>

          <div className="space-y-3">
            {config.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground font-mono block mb-1.5">
                  {field.label}
                </label>
                <div className="flex gap-2">
                  <input
                    type={field.type === 'password' && !showFields[field.key] ? 'password' : 'text'}
                    value={values[field.key] || ''}
                    onChange={(event) =>
                      setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  {field.type === 'password' && (
                    <button
                      onClick={() =>
                        setShowFields((previous) => ({ ...previous, [field.key]: !previous[field.key] }))
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-elevated"
                    >
                      {showFields[field.key] ? <Shield size={14} /> : <Key size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {config.docsUrl && (
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} />
              Open setup guide
            </a>
          )}

        </div>

        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-elevated text-foreground font-medium text-sm py-2.5 rounded-lg hover:bg-muted transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Globe size={13} className="animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate live'
              )}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              {saved ? (
                <>
                  <Check size={13} />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="w-full text-xs text-destructive hover:text-destructive/80 py-2 transition-colors"
            >
              Disconnect {config.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectorConfigModal;
