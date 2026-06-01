import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const KPIS = [
  { label: 'Active rentals', value: '—' },
  { label: 'Pending approvals', value: '—' },
  { label: 'Pending KYC', value: '—' },
  { label: 'Available cars', value: '—' },
] as const;

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live KPIs and today&apos;s schedule land here in Plan #10.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
