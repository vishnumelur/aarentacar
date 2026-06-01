import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      verificationStatus: user.verificationStatus,
    },
  });
}
