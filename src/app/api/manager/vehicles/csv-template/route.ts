import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

const HEADER = [
  'type_slug',
  'branch_name',
  'make',
  'model',
  'year',
  'plate',
  'color',
  'transmission',
  'seats',
  'doors',
  'fuel_type',
  'status',
  'primary_photo_url',
  'notes',
];

const SAMPLE = [
  'economy,Al Karama HQ,Toyota,Yaris,2024,DXB-A-12345,White,automatic,5,4,petrol,active,,',
  'luxury,Dubai Media City,Mercedes,S-Class,2025,DXB-X-77777,Black,automatic,5,4,petrol,active,,',
  'limo-stretch,Al Karama HQ,Cadillac,Stretch,2023,DXB-L-00001,White,automatic,10,4,petrol,active,,Wedding edition',
];

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return new Response('forbidden', { status: 403 });
  }
  const body = [HEADER.join(','), ...SAMPLE].join('\n') + '\n';
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="vehicles-template.csv"',
    },
  });
}
