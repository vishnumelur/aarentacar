import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('registerTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
