import { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#0a0a0b' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#dc2626', marginBottom: 4 },
  subheader: { fontSize: 10, color: '#666', marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 6,
    color: '#0a0a0b',
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, color: '#666' },
  value: { flex: 1 },
  totalsBox: { marginTop: 12, padding: 10, border: '1pt solid #dc2626', borderRadius: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLine: { fontSize: 14, fontWeight: 'bold' },
  terms: { fontSize: 9, color: '#444', lineHeight: 1.5, marginTop: 16 },
  signatureBox: { marginTop: 32 },
  signatureImage: { width: 200, height: 80, objectFit: 'contain' },
  signatureLine: { borderTop: '1pt solid #0a0a0b', width: 200, marginTop: 2, paddingTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#aaa',
  },
});

export interface AgreementData {
  bookingCode: string;
  generatedAt: Date;
  customer: { fullName: string; email: string; phone: string | null; nationality: string | null };
  vehicle: { make: string; model: string; year: number; plate: string };
  rental: {
    kind: 'self_drive' | 'chauffeur';
    pickupAt: Date;
    returnAt: Date;
    pickupAddress: string;
  };
  amounts: { subtotalAed: number; addonsAed: number; depositAed: number; totalAed: number };
  signatureDataUrl: string | null; // 'data:image/png;base64,...'
}

export async function renderRentalAgreementPdf(data: AgreementData): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.header}>AA Rent A Car</Text>
        <Text style={styles.subheader}>
          Rental Agreement · {data.bookingCode} · Generated {data.generatedAt.toLocaleString()}
        </Text>

        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Full name</Text>
          <Text style={styles.value}>{data.customer.fullName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{data.customer.email}</Text>
        </View>
        {data.customer.phone && (
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{data.customer.phone}</Text>
          </View>
        )}
        {data.customer.nationality && (
          <View style={styles.row}>
            <Text style={styles.label}>Nationality</Text>
            <Text style={styles.value}>{data.customer.nationality}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Vehicle</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Make / Model</Text>
          <Text style={styles.value}>
            {data.vehicle.make} {data.vehicle.model}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Year</Text>
          <Text style={styles.value}>{String(data.vehicle.year)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Plate</Text>
          <Text style={styles.value}>{data.vehicle.plate}</Text>
        </View>

        <Text style={styles.sectionTitle}>Rental period</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Type</Text>
          <Text style={styles.value}>
            {data.rental.kind === 'self_drive' ? 'Self-drive' : 'With chauffeur'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.value}>{data.rental.pickupAt.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Return</Text>
          <Text style={styles.value}>{data.rental.returnAt.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Pickup address</Text>
          <Text style={styles.value}>{data.rental.pickupAddress}</Text>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>Rental subtotal</Text>
            <Text>AED {data.amounts.subtotalAed.toLocaleString()}</Text>
          </View>
          {data.amounts.addonsAed > 0 && (
            <View style={styles.totalRow}>
              <Text>Add-ons</Text>
              <Text>AED {data.amounts.addonsAed.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text>Refundable deposit hold</Text>
            <Text>AED {data.amounts.depositAed.toLocaleString()}</Text>
          </View>
          <View
            style={[
              styles.totalRow,
              { borderTop: '1pt solid #dc2626', marginTop: 4, paddingTop: 4 },
            ]}
          >
            <Text style={styles.totalLine}>Total</Text>
            <Text style={styles.totalLine}>AED {data.amounts.totalAed.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Terms (Phase 1 stub)</Text>
        <Text style={styles.terms}>
          The customer agrees to return the vehicle in the same condition as received, with the same
          fuel level and no additional damage. The deposit will be refunded within 7 business days
          of return, less any agreed charges for damage, traffic fines, or unpaid tolls. The
          customer warrants they hold a valid driving licence covering the rental period. Full
          terms and conditions are available at aa-rentacar.com/terms.
        </Text>

        <View style={styles.signatureBox}>
          <Text style={styles.label}>Customer signature</Text>
          {data.signatureDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.signatureDataUrl} style={styles.signatureImage} />
          ) : (
            <View style={styles.signatureLine}>
              <Text>(signed)</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          AA Rent A Car · Khalifa bin Zayed Street, Al Karama, Dubai · +971 4 3377877
        </Text>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
