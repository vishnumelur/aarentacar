import { DriverForm } from '@/components/manager/driver-form';

export default function NewDriverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add driver</h1>
        <p className="text-sm text-muted-foreground">
          Creates a new user with role &apos;driver&apos; + a driver_profiles row. Driver receives credentials out-of-band.
        </p>
      </div>
      <DriverForm mode="create" />
    </div>
  );
}
