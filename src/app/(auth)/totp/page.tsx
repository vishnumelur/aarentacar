import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TotpChallengeForm } from '@/components/auth/totp-challenge-form';

export const dynamic = 'force-dynamic';

export default function TotpPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or a recovery code.
        </p>
      </CardHeader>
      <CardContent>
        <TotpChallengeForm />
      </CardContent>
    </Card>
  );
}
