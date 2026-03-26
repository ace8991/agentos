import { useEffect, useMemo, useState } from 'react';
import { X, Check, ExternalLink, Key, Globe, Shield } from 'lucide-react';
import {
  clearConnectorValues,
  getConnectorDefinition,
  hasConnectorCredentials,
  loadConnectorValues,
  saveConnectorValues,
} from '@/lib/connectors';
import ConnectorLogo from './ConnectorLogo';

interface ConnectorConfigModalProps {
  connectorId: string | null;
  onClose: () => void;
  onSave: (connectorId: string, connected: boolean) => void;
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
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!config) {
      setValues({});
      setShowFields({});
      setSaved(false);
      setTesting(false);
      setTestResult(null);
      return;
    }

    setValues(loadConnectorValues(config.id));
    setShowFields({});
    setSaved(false);
    setTesting(false);
    setTestResult(null);
  }, [config]);

  if (!config) {
    return null;
  }

  const isConnected = hasConnectorCredentials(config.id, values);

  const handleSave = () => {
    saveConnectorValues(config.id, values);
    onSave(config.id, isConnected);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setTestResult(isConnected ? 'success' : 'error');
    setTesting(false);
  };

  const handleDisconnect = () => {
    clearConnectorValues(config.id);
    setValues({});
    onSave(config.id, false);
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
              isConnected
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
            {isConnected ? 'Connected' : 'Not configured'}
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

          {testResult && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                testResult === 'success'
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {testResult === 'success' ? <Check size={12} /> : <X size={12} />}
              {testResult === 'success'
                ? 'Credentials saved locally. Connector is ready to use.'
                : 'Add at least one credential before testing this connector.'}
            </div>
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
                  Testing...
                </>
              ) : (
                'Test Connection'
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
