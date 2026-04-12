import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  Radio,
  RefreshCw,
  Smartphone,
  Waves,
} from 'lucide-react';
import {
  getMobileHubState,
  pairMobileHubDevice,
  updateMobileHubChannel,
  updateMobileHubDevice,
  updateMobileHubGateway,
  updateMobileHubOverlay,
  type MobileHubChannel,
  type MobileHubChannelId,
  type MobileHubDevice,
  type MobileHubDevicePlatform,
  type MobileHubDeviceRole,
  type MobileHubState,
} from '@/lib/api';
import { mirrorMobileHubOverlayState } from '@/lib/mobile-hub';
import { toast } from '@/components/ui/sonner';

const platformOptions: MobileHubDevicePlatform[] = ['android', 'ios', 'desktop', 'web'];
const roleOptions: MobileHubDeviceRole[] = ['operator', 'node', 'viewer'];

const MobileHubPanel = () => {
  const [state, setState] = useState<MobileHubState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pairingName, setPairingName] = useState('Pixel 9');
  const [pairingPlatform, setPairingPlatform] = useState<MobileHubDevicePlatform>('android');
  const [pairingRole, setPairingRole] = useState<MobileHubDeviceRole>('operator');
  const [channelSecrets, setChannelSecrets] = useState<Record<string, string>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await getMobileHubState();
      setState(next);
      mirrorMobileHubOverlayState(next.overlays);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load mobile hub state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const configuredChannels = useMemo(
    () => state?.channels.filter((channel) => channel.configured).length ?? 0,
    [state],
  );

  const applyState = (next: MobileHubState, successMessage?: string) => {
    setState(next);
    mirrorMobileHubOverlayState(next.overlays);
    if (successMessage) {
      toast.success(successMessage);
    }
  };

  const toggleGateway = async (enabled: boolean) => {
    try {
      const next = await updateMobileHubGateway({ enabled });
      applyState(next, enabled ? 'Gateway enabled' : 'Gateway paused');
    } catch (error) {
      console.error(error);
      toast.error('Could not update gateway status.');
    }
  };

  const handlePairDevice = async () => {
    try {
      const next = await pairMobileHubDevice({
        name: pairingName,
        platform: pairingPlatform,
        role: pairingRole,
      });
      applyState(next, 'Pairing session created');
    } catch (error) {
      console.error(error);
      toast.error('Could not create a pairing session.');
    }
  };

  const handleChannelSave = async (channelId: MobileHubChannelId, enabled: boolean) => {
    try {
      const next = await updateMobileHubChannel(channelId, {
        enabled,
        secret: channelSecrets[channelId] || '',
      });
      applyState(next, 'Channel updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not update this messaging channel.');
    }
  };

  const handleOverlayToggle = async (key: keyof MobileHubState['overlays'], value: boolean) => {
    try {
      const next = await updateMobileHubOverlay({ [key]: value });
      applyState(next, 'Overlay settings updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not update overlay settings.');
    }
  };

  const handlePushToTalkSave = async (value: string) => {
    try {
      const next = await updateMobileHubOverlay({ push_to_talk: value });
      applyState(next, 'Push-to-talk shortcut updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not save push-to-talk shortcut.');
    }
  };

  const updateDeviceStatus = async (device: MobileHubDevice, online: boolean) => {
    try {
      const next = await updateMobileHubDevice(device.id, {
        status: online ? 'online' : 'offline',
        overlay_enabled: device.overlay_enabled,
        voice_wake_enabled: device.voice_wake_enabled,
        battery_percent: device.battery_percent ?? undefined,
      });
      applyState(next, `Device marked ${online ? 'online' : 'offline'}`);
    } catch (error) {
      console.error(error);
      toast.error('Could not update device status.');
    }
  };

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Command copied');
    } catch {
      toast.error('Clipboard is unavailable in this browser.');
    }
  };

  if (loading && !state) {
    return <p className="text-sm text-muted-foreground">Loading mobile hub...</p>;
  }

  if (!state) {
    return <p className="text-sm text-destructive">Mobile hub is unavailable right now.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-foreground">Mobile Hub</h3>
          <p className="text-xs text-muted-foreground">
            Mobile channels, device pairing, CLI onboarding, and desktop or mobile overlays built into AgentOS.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          title="Refresh mobile hub"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={Radio} title="Gateway" value={state.gateway.status} detail={`${state.gateway.host}:${state.gateway.port}`} />
        <StatCard icon={Smartphone} title="Devices" value={`${state.gateway.connected_devices} online`} detail={`${state.devices.length} registered`} />
        <StatCard icon={MessageSquare} title="Channels" value={`${configuredChannels} configured`} detail="Telegram, WhatsApp, webhook, Slack, and more" />
        <StatCard icon={Waves} title="Overlays" value={state.overlays.voice_overlay ? 'Voice ready' : 'Voice off'} detail={state.overlays.mobile_hud ? 'Mobile HUD active' : 'HUD paused'} />
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Multi-device gateway</p>
            <p className="text-xs text-muted-foreground">
              Protocol v{state.gateway.protocol_version} · discovery {state.gateway.discovery_mode} · inbound {state.gateway.inbound_path}
            </p>
          </div>
          <Toggle
            checked={state.gateway.enabled}
            onChange={(checked) => {
              void toggleGateway(checked);
            }}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Pairing code</p>
            <p className="mt-1 text-lg font-semibold tracking-[0.2em] text-foreground">
              {state.gateway.pairing_code || '—'}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Use this code when onboarding a mobile operator, node, or viewer into AgentOS.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Transport</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {state.gateway.tls_enabled ? 'TLS protected' : 'Local network only'}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {state.gateway.tls_enabled
                ? `Fingerprint: ${state.gateway.tls_fingerprint || 'pending'}`
                : 'Enable TLS when exposing the gateway outside your trusted local network.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Pair a new device</p>
          <p className="text-xs text-muted-foreground">Register Android, iOS, desktop, or web devices as operator, node, or viewer clients.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr_0.9fr_auto]">
          <input
            value={pairingName}
            onChange={(event) => setPairingName(event.target.value)}
            className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Device name"
          />
          <select
            value={pairingPlatform}
            onChange={(event) => setPairingPlatform(event.target.value as MobileHubDevicePlatform)}
            className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <select
            value={pairingRole}
            onChange={(event) => setPairingRole(event.target.value as MobileHubDeviceRole)}
            className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handlePairDevice()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Pair
          </button>
        </div>
        <div className="space-y-2">
          {state.devices.map((device) => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/35 px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{device.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${device.status === 'online' ? 'bg-emerald-500/15 text-emerald-300' : device.status === 'pairing' ? 'bg-amber-500/15 text-amber-200' : 'bg-muted text-muted-foreground'}`}>
                    {device.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {device.platform} · {device.role}
                  {device.battery_percent != null ? ` · ${device.battery_percent}% battery` : ''}
                  {device.pair_code ? ` · pair code ${device.pair_code}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void updateDeviceStatus(device, device.status !== 'online')}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-elevated"
                >
                  {device.status === 'online' ? 'Mark offline' : 'Mark online'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Messaging channels</p>
            <p className="text-xs text-muted-foreground">Wire Telegram, WhatsApp, webhook, and escalation channels into the AgentOS gateway.</p>
        </div>
        <div className="space-y-3">
          {state.channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              secretValue={channelSecrets[channel.id] ?? ''}
              onSecretChange={(value) => setChannelSecrets((prev) => ({ ...prev, [channel.id]: value }))}
              onSave={(enabled) => {
                void handleChannelSave(channel.id, enabled);
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Voice and mobile overlays</p>
            <p className="text-xs text-muted-foreground">Drive the AgentOS floating dock, mobile HUD, camera HUD, and voice wake workflow from one place.</p>
          </div>
          <ToggleRow label="Floating dock overlay" checked={state.overlays.floating_dock} onChange={(checked) => void handleOverlayToggle('floating_dock', checked)} />
          <ToggleRow label="Mobile HUD preview" checked={state.overlays.mobile_hud} onChange={(checked) => void handleOverlayToggle('mobile_hud', checked)} />
          <ToggleRow label="Voice overlay badges" checked={state.overlays.voice_overlay} onChange={(checked) => void handleOverlayToggle('voice_overlay', checked)} />
          <ToggleRow label="Voice wake" checked={state.overlays.voice_wake} onChange={(checked) => void handleOverlayToggle('voice_wake', checked)} />
          <ToggleRow label="Camera HUD" checked={state.overlays.camera_hud} onChange={(checked) => void handleOverlayToggle('camera_hud', checked)} />
          <div>
            <label className="text-xs text-muted-foreground">Push-to-talk shortcut</label>
            <div className="mt-1 flex gap-2">
              <input
                defaultValue={state.overlays.push_to_talk}
                onBlur={(event) => void handlePushToTalkSave(event.target.value)}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">CLI onboarding</p>
            <p className="text-xs text-muted-foreground">Copy the local CLI commands that mirror the AgentOS onboarding and gateway workflow.</p>
          </div>
          {state.cli_commands.map((command) => (
            <div key={command.label} className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{command.label}</p>
                  <p className="text-xs text-muted-foreground">{command.description}</p>
                </div>
                <button
                  onClick={() => void copyCommand(command.command)}
                  className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                  title="Copy command"
                >
                  <Copy size={13} />
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-[#07090f] px-3 py-2 text-[11px] text-emerald-300">
                {command.command}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Radio;
  title: string;
  value: string;
  detail: string;
}) => (
  <div className="rounded-xl border border-border bg-card/60 p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
  </div>
);

const ChannelRow = ({
  channel,
  secretValue,
  onSecretChange,
  onSave,
}: {
  channel: MobileHubChannel;
  secretValue: string;
  onSecretChange: (value: string) => void;
  onSave: (enabled: boolean) => void;
}) => (
  <div className="rounded-lg border border-border bg-muted/35 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{channel.name}</p>
          {channel.configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
              <Check size={11} />
              {channel.secret_hint || 'configured'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{channel.description}</p>
        {channel.relay_path && <p className="mt-1 text-[11px] text-muted-foreground">Relay path: {channel.relay_path}</p>}
      </div>
      <Toggle checked={channel.enabled} onChange={onSave} />
    </div>
    <div className="mt-3 flex gap-2">
      <input
        value={secretValue}
        onChange={(event) => onSecretChange(event.target.value)}
        placeholder="Secret / token / shared key"
        className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        onClick={() => onSave(channel.enabled)}
        className="rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-elevated"
      >
        Save
      </button>
    </div>
  </div>
);

const ToggleRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/35 px-3 py-2.5">
    <span className="text-sm text-foreground">{label}</span>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${checked ? 'left-5' : 'left-0.5'}`}
    />
  </button>
);

export default MobileHubPanel;


