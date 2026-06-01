import Link from 'next/link';
import { Phone, MessageSquare } from 'lucide-react';

interface Props {
  assignmentId: string;
  bookingCode: string;
  status: 'offered' | 'accepted';
  pickupAt: Date;
  pickupAddress: string;
  customerName: string;
  customerPhone: string | null;
  vehicleMake: string;
  vehicleModel: string;
  rentalKind: 'self_drive' | 'chauffeur';
}

export function JobCard({
  assignmentId,
  bookingCode,
  status,
  pickupAt,
  pickupAddress,
  customerName,
  customerPhone,
  vehicleMake,
  vehicleModel,
  rentalKind,
}: Props) {
  const whatsappLink = customerPhone
    ? `https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <article
      className={`rounded-lg border-2 p-4 ${
        status === 'accepted' ? 'border-primary bg-primary/5' : 'border-card bg-card'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-xs text-muted-foreground">{bookingCode}</div>
          <div className="font-semibold">
            {vehicleMake} {vehicleModel}
          </div>
          <div className="text-xs text-muted-foreground capitalize">
            {rentalKind.replace(/_/g, ' ')}
          </div>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            status === 'accepted'
              ? 'bg-green-100 text-green-900'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {status === 'accepted' ? 'Active' : 'Awaiting your accept'}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="font-medium">{new Date(pickupAt).toLocaleString()}</div>
        <div className="text-muted-foreground">{pickupAddress}</div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-sm">
          <div className="font-medium">{customerName}</div>
          <div className="flex gap-3 text-xs">
            {customerPhone && (
              <a href={`tel:${customerPhone}`} className="text-primary inline-flex items-center gap-1">
                <Phone className="size-3" /> Call
              </a>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1"
              >
                <MessageSquare className="size-3" /> WhatsApp
              </a>
            )}
          </div>
        </div>
        <Link
          href={`/driver/jobs/${assignmentId}`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open job
        </Link>
      </div>
    </article>
  );
}
