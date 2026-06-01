import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'driver' | 'manager';
  customerProfile?: {
    residency: 'tourist' | 'resident';
    dateOfBirth: string;
    nationality: string;
  };
  documents?: Array<{
    type:
      | 'passport'
      | 'visa'
      | 'emirates_id_front'
      | 'emirates_id_back'
      | 'driving_license_front'
      | 'driving_license_back'
      | 'international_permit';
    expiryDate: string | null;
    status: 'pending' | 'approved' | 'rejected';
  }>;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
}

const testUsers: TestUser[] = [
  {
    email: 'customer@test.com',
    password: 'customer-test-password',
    fullName: 'Test Customer (Verified Tourist)',
    phone: '+971500000001',
    role: 'customer',
    verificationStatus: 'verified',
    customerProfile: {
      residency: 'tourist',
      dateOfBirth: '1990-01-15',
      nationality: 'United Kingdom',
    },
    documents: [
      { type: 'passport', expiryDate: '2030-12-31', status: 'approved' },
      { type: 'visa', expiryDate: '2026-09-30', status: 'approved' },
      { type: 'driving_license_front', expiryDate: '2029-06-15', status: 'approved' },
      { type: 'driving_license_back', expiryDate: null, status: 'approved' },
    ],
  },
  {
    email: 'pending@test.com',
    password: 'pending-test-password',
    fullName: 'Test Customer (Pending KYC)',
    phone: '+971500000002',
    role: 'customer',
    verificationStatus: 'pending',
    customerProfile: {
      residency: 'resident',
      dateOfBirth: '1985-05-20',
      nationality: 'India',
    },
    documents: [
      { type: 'emirates_id_front', expiryDate: '2028-03-31', status: 'pending' },
      { type: 'emirates_id_back', expiryDate: null, status: 'pending' },
      { type: 'driving_license_front', expiryDate: '2027-11-30', status: 'pending' },
      { type: 'driving_license_back', expiryDate: null, status: 'pending' },
    ],
  },
  {
    email: 'driver1@test.com',
    password: 'driver-test-password',
    fullName: 'Test Driver One',
    phone: '+971500000003',
    role: 'driver',
  },
  {
    email: 'manager@test.com',
    password: 'manager-test-password',
    fullName: 'Test Manager',
    phone: '+971500000004',
    role: 'manager',
  },
];

const PLACEHOLDER_DOC_KEY = 'documents/placeholder/test-fixture.jpg';

async function main() {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const { users, customerProfiles, customerDocuments } = await import('@/db/schema');
  const { hashPassword } = await import('@/lib/auth/password');

  for (const u of testUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    let userId: string;
    if (existing.length > 0) {
      userId = existing[0]!.id;
      console.warn(`User ${u.email} already exists — skipping creation`);
    } else {
      const passwordHash = await hashPassword(u.password);
      const [created] = await db
        .insert(users)
        .values({
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          verificationStatus: u.verificationStatus ?? 'unverified',
        })
        .returning({ id: users.id });
      if (!created) throw new Error(`Failed to create ${u.email}`);
      userId = created.id;
      console.warn(`Created ${u.role}: ${u.email}`);
    }

    if (u.customerProfile) {
      const existingProfile = await db
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, userId))
        .limit(1);
      if (existingProfile.length === 0) {
        await db.insert(customerProfiles).values({
          userId,
          residency: u.customerProfile.residency,
          dateOfBirth: u.customerProfile.dateOfBirth,
          nationality: u.customerProfile.nationality,
        });
        console.warn(`  Seeded customer profile (${u.customerProfile.residency})`);
      }
    }

    if (u.documents) {
      const { and } = await import('drizzle-orm');
      for (const d of u.documents) {
        const existingDoc = await db
          .select()
          .from(customerDocuments)
          .where(
            and(
              eq(customerDocuments.customerId, userId),
              eq(customerDocuments.type, d.type),
            ),
          )
          .limit(1);
        if (existingDoc.length === 0) {
          await db.insert(customerDocuments).values({
            customerId: userId,
            type: d.type,
            fileUrl: PLACEHOLDER_DOC_KEY,
            expiryDate: d.expiryDate,
            status: d.status,
            reviewedAt: d.status === 'approved' ? new Date() : null,
          });
          console.warn(`  Seeded document: ${d.type} (${d.status})`);
        }
      }
    }
  }

  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
