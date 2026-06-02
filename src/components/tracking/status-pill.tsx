'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { StatusResult } from '@/lib/tracking/status';

interface StatusPillProps {
  status: StatusResult;
  reducedMotion: boolean;
}

/**
 * Crossfading status pill that transitions through the Swiggy-style stages:
 * assigned → on the way → {n} minutes away → almost there → arrived.
 */
export function StatusPill({ status, reducedMotion }: StatusPillProps): React.ReactElement {
  const t = useTranslations('tracking');

  let label: string;
  switch (status.key) {
    case 'assigned':
      label = t('status.assigned');
      break;
    case 'on_the_way':
      label = t('status.onTheWay');
      break;
    case 'minutes_away':
      label = t('status.minutesAway', { minutes: status.minutes ?? 0 });
      break;
    case 'almost_there':
      label = t('status.almostThere');
      break;
    case 'arrived':
      label = t('status.arrived');
      break;
  }

  const isArrived = status.key === 'arrived';

  const content = (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg',
        isArrived ? 'bg-green-600 text-white' : 'bg-card text-foreground',
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          isArrived ? 'bg-white' : 'bg-primary',
          reducedMotion ? '' : 'animate-pulse',
        ].join(' ')}
        aria-hidden
      />
      {label}
    </span>
  );

  if (reducedMotion) {
    return (
      <div role="status" aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={status.key + (status.minutes ?? '')}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
