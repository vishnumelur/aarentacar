'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMyDriverStatus } from '@/lib/actions/driver-self';

type ServerStatus = 'available' | 'on_duty' | 'off_duty' | 'suspended';
type UiChoice = 'available' | 'off_duty' | 'break';

interface Props {
  initialStatus: ServerStatus;
}

const LS_KEY = 'driver-status-ui-label';

export function SelfStatusToggle({ initialStatus }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ui, setUi] = useState<UiChoice>('off_duty');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatus === 'available') {
      setUi('available');
      return;
    }
    if (initialStatus === 'off_duty') {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
      setUi(saved === 'break' ? 'break' : 'off_duty');
      return;
    }
    if (initialStatus === 'on_duty') {
      // System-managed — show as Available in the toggle but disabled.
      setUi('available');
    }
  }, [initialStatus]);

  function onPick(choice: UiChoice) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, choice);
    }
    setUi(choice);
    setMsg(null);

    const serverStatus: ServerStatus = choice === 'available' ? 'available' : 'off_duty';
    const fd = new FormData();
    fd.set('status', serverStatus);

    start(async () => {
      const res = await setMyDriverStatus(fd);
      if (!res.ok) {
        setMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  const isOnDuty = initialStatus === 'on_duty';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: 'available', label: 'Available' },
            { key: 'off_duty', label: 'Off duty' },
            { key: 'break', label: 'Break' },
          ] as const
        ).map((opt) => {
          const active = ui === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={pending || isOnDuty}
              onClick={() => onPick(opt.key)}
              className={`rounded-md border px-3 py-3 text-sm font-medium transition ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted'
              } ${isOnDuty ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {isOnDuty && (
        <p className="text-xs text-muted-foreground">
          You&apos;re currently on an active job. Status will return to Available once you complete the return inspection.
        </p>
      )}
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </div>
  );
}
