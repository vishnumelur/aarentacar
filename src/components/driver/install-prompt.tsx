'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIosNonStandalone, setIsIosNonStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip as EventListener);
    // iOS standalone detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator as any).standalone;
    setIsIosNonStandalone(ios);
    setDismissed(localStorage.getItem('install-prompt-dismissed') === '1');
    return () => window.removeEventListener('beforeinstallprompt', onBip as EventListener);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('install-prompt-dismissed', '1');
  }

  if (dismissed) return null;
  if (!deferred && !isIosNonStandalone) return null;

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium">Install AA Driver</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {deferred
              ? 'Install this app on your home screen for one-tap access and reliable notifications.'
              : 'Tap the Share button below and choose "Add to Home Screen" to install.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
      {deferred && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={async () => {
              await deferred.prompt();
              const result = await deferred.userChoice;
              if (result.outcome === 'accepted') dismiss();
            }}
          >
            Install
          </Button>
        </div>
      )}
    </div>
  );
}
