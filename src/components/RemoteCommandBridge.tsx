import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { claimRemoteCommand, completeRemoteCommand, getRemoteCommands } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

const AUTO_EXECUTE_KEY = 'REMOTE_AUTO_EXECUTE_LOCAL';

const RemoteCommandBridge = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendChecked = useStore((s) => s.backendChecked);
  const backendHealth = useStore((s) => s.backendHealth);
  const status = useStore((s) => s.status);
  const setTask = useStore((s) => s.setTask);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const startAgent = useStore((s) => s.startAgent);
  const reset = useStore((s) => s.reset);
  const activeCommandIdRef = useRef<string | null>(null);
  const notifiedPendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!backendChecked || !backendOnline) {
      return;
    }

    const poll = async () => {
      const autoExecuteEnabled = localStorage.getItem(AUTO_EXECUTE_KEY) === 'true';
      const isLocalWorkspace = backendHealth?.mode === 'local';

      try {
        const pending = await getRemoteCommands('pending');
        const latestPendingId = pending[0]?.id ?? null;
        if (latestPendingId && notifiedPendingRef.current !== latestPendingId) {
          notifiedPendingRef.current = latestPendingId;
          toast.message('A remote command is waiting for approval.');
        }
      } catch {
        // Ignore toast polling failures quietly.
      }

      if (!autoExecuteEnabled || !isLocalWorkspace || activeCommandIdRef.current) {
        return;
      }

      if (!['idle', 'done', 'error'].includes(status)) {
        return;
      }

      try {
        const approved = await getRemoteCommands('approved');
        const next = approved[0];
        if (!next) return;

        const claimed = await claimRemoteCommand(next.id);
        activeCommandIdRef.current = claimed.id;
        reset();
        setTask(claimed.text);
        setActiveThread('agent');
        toast.message(`Running remote ${claimed.channel} command from ${claimed.sender || 'remote sender'}.`);

        window.setTimeout(() => {
          startAgent();
        }, 120);
      } catch (error) {
        console.error('Remote command auto-execution failed', error);
      }
    };

    poll();
    const interval = window.setInterval(poll, 5000);
    return () => window.clearInterval(interval);
  }, [backendChecked, backendHealth?.mode, backendOnline, reset, setActiveThread, setTask, startAgent, status]);

  useEffect(() => {
    const activeCommandId = activeCommandIdRef.current;
    if (!activeCommandId) return;
    if (status !== 'done' && status !== 'error') return;

    completeRemoteCommand(
      activeCommandId,
      status === 'done',
      status === 'done' ? 'Executed on local workspace' : 'Execution ended with an error',
    )
      .catch((error) => {
        console.error('Unable to complete remote command', error);
      })
      .finally(() => {
        activeCommandIdRef.current = null;
      });
  }, [status]);

  return null;
};

export default RemoteCommandBridge;
