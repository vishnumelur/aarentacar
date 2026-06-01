import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const t = useTranslations('Auth');
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('loginTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
