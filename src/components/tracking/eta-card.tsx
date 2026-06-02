'use client';

import { Phone, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatEta } from '@/lib/tracking/interpolation';

export interface DriverInfo {
  name: string;
  photoUrl: string | null;
  carModel: string | null;
  plate: string | null;
  phone: string | null;
}

interface EtaCardProps {
  driver: DriverInfo | null;
  /** Live seconds-remaining (ticked client-side every second). */
  secondsRemaining: number | null;
  locale: 'en' | 'ar';
}

export function EtaCard({ driver, secondsRemaining, locale }: EtaCardProps): React.ReactElement {
  const t = useTranslations('tracking');

  const phoneDigits = driver?.phone?.replace(/[^\d+]/g, '') ?? null;
  const waNumber = phoneDigits?.replace(/^\+/, '') ?? null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-2xl">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote driver
            avatar from object storage; next/image config is out of scope here. */}
        <img
          src={driver?.photoUrl ?? '/avatar-placeholder.svg'}
          alt=""
          className="h-12 w-12 rounded-full bg-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {driver?.name ?? t('driver.unknown')}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {[driver?.carModel, driver?.plate].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{t('etaLabel')}</div>
          <div className="text-lg font-bold tabular-nums">
            {secondsRemaining === null ? '—' : formatEta(secondsRemaining, locale)}
          </div>
        </div>
      </div>

      {(phoneDigits || waNumber) && (
        <div className="mt-3 flex gap-2">
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {t('call')}
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('whatsapp')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
