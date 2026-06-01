import { describe, it, expect } from 'vitest';
import { validateCsvRows, type CsvRow } from '@/lib/csv-import/validate';

const lookups = {
  typeSlugToId: new Map([
    ['economy', 't-economy'],
    ['luxury', 't-luxury'],
  ]),
  branchNameToId: new Map([['Al Karama HQ', 'b-karama']]),
  existingPlates: new Set(['DXB-EXISTING']),
};

const valid: CsvRow = {
  type_slug: 'economy',
  branch_name: 'Al Karama HQ',
  make: 'Toyota',
  model: 'Yaris',
  year: '2024',
  plate: 'DXB-NEW',
  color: 'White',
  transmission: 'automatic',
  seats: '5',
  doors: '4',
  fuel_type: 'petrol',
  status: 'active',
  primary_photo_url: '',
  notes: '',
};

describe('validateCsvRows', () => {
  it('accepts a fully valid row', () => {
    const report = validateCsvRows([valid], lookups);
    expect(report.ok).toBe(true);
    expect(report.rows[0]!.error).toBeNull();
    expect(report.rows[0]!.parsed?.plate).toBe('DXB-NEW');
    expect(report.rows[0]!.parsed?.branchId).toBe('b-karama');
    expect(report.rows[0]!.parsed?.typeId).toBe('t-economy');
  });

  it('rejects unknown type slug', () => {
    const report = validateCsvRows([{ ...valid, type_slug: 'flying-car' }], lookups);
    expect(report.ok).toBe(false);
    expect(report.rows[0]!.error).toMatch(/type_slug/);
  });

  it('rejects unknown branch_name when provided', () => {
    const report = validateCsvRows(
      [{ ...valid, branch_name: 'Mars Branch' }],
      lookups,
    );
    expect(report.rows[0]!.error).toMatch(/branch_name/);
  });

  it('rejects duplicate plate vs DB', () => {
    const report = validateCsvRows([{ ...valid, plate: 'DXB-EXISTING' }], lookups);
    expect(report.rows[0]!.error).toMatch(/plate_taken/);
  });

  it('rejects duplicate plate within the same upload', () => {
    const report = validateCsvRows(
      [
        { ...valid, plate: 'DXB-DUP' },
        { ...valid, plate: 'DXB-DUP' },
      ],
      lookups,
    );
    expect(report.rows[0]!.error).toBeNull();
    expect(report.rows[1]!.error).toMatch(/plate_duplicate_in_csv/);
  });

  it('allows empty branch_name (becomes null)', () => {
    const report = validateCsvRows([{ ...valid, branch_name: '' }], lookups);
    expect(report.rows[0]!.error).toBeNull();
    expect(report.rows[0]!.parsed?.branchId).toBeNull();
  });

  it('rejects invalid transmission', () => {
    const report = validateCsvRows([{ ...valid, transmission: 'jetpack' }], lookups);
    expect(report.rows[0]!.error).toMatch(/transmission/);
  });

  it('counts errors and totals', () => {
    const report = validateCsvRows(
      [
        { ...valid, plate: 'DXB-A' },
        { ...valid, plate: 'DXB-EXISTING' },
        { ...valid, plate: 'DXB-B' },
      ],
      lookups,
    );
    expect(report.totalRows).toBe(3);
    expect(report.errors).toBe(1);
    expect(report.ok).toBe(false);
  });
});
