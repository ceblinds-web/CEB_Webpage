import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1C1C1E' },
  headerRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#8B6914', paddingBottom: 10, marginBottom: 16 },
  logo: { width: 44, height: 44, marginRight: 12 },
  brand: { fontSize: 16, color: '#8B6914', fontWeight: 700 },
  tagline: { fontSize: 8, color: '#888' },
  h1: { fontSize: 14, marginBottom: 4, fontWeight: 700 },
  meta: { fontSize: 10, color: '#555', marginBottom: 14 },
  table: { marginTop: 8 },
  tr: { flexDirection: 'row' },
  thCell: { backgroundColor: '#1C1C1E', color: '#fff', padding: 6, fontSize: 9, fontWeight: 700 },
  tdCell: { padding: 6, fontSize: 9, borderBottomWidth: 1, borderBottomColor: '#eee' },
  colDesc: { flex: 2 }, colPct: { flex: 1, textAlign: 'right' }, colAmt: { flex: 1, textAlign: 'right' },
  totalBox: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 10, color: '#4A5568' },
  grandLabel: { fontSize: 13, fontWeight: 700 },
  grandValue: { fontSize: 14, fontWeight: 700, color: '#8B6914' },
  footer: { marginTop: 30, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', fontSize: 8, color: '#999', textAlign: 'center' },
  statusBadge: { fontSize: 9, fontWeight: 700, padding: '3 8', color: '#92400E', backgroundColor: '#FEF3C7', alignSelf: 'flex-start', marginBottom: 10 },
})

export type InvoicePdfData = {
  invoiceNumber: string
  invoiceType: string | null
  pctOfTotal: number | null
  totalAmount: number
  status: string
  projectName: string
  customerName: string
  address?: string | null
  logoUrl?: string
}

const fmt = (n: number) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function InvoiceDocument(d: InvoicePdfData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {d.logoUrl && <Image src={d.logoUrl} style={styles.logo} />}
          <View>
            <Text style={styles.brand}>Custom Elegant Blinds</Text>
            <Text style={styles.tagline}>Zebra Blinds · Honey Comb · Dream Curtain · customelegantblinds.com · Monroe, WA</Text>
          </View>
        </View>

        <Text style={styles.statusBadge}>{d.status.toUpperCase()}</Text>
        <Text style={styles.h1}>Invoice {d.invoiceNumber}</Text>
        <Text style={styles.meta}>{d.customerName} · {d.projectName}{d.address ? ' · ' + d.address : ''}</Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.thCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.thCell, styles.colPct]}>% of Total</Text>
            <Text style={[styles.thCell, styles.colAmt]}>Amount</Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.tdCell, styles.colDesc]}>{d.invoiceType || 'Invoice'}</Text>
            <Text style={[styles.tdCell, styles.colPct]}>{d.pctOfTotal || 0}%</Text>
            <Text style={[styles.tdCell, styles.colAmt]}>{fmt(d.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.grandLabel}>TOTAL DUE</Text>
            <Text style={styles.grandValue}>{fmt(d.totalAmount)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>Custom Elegant Blinds LLC · customelegantblinds.com · Monroe, WA — This is a computer-generated invoice.</Text>
      </Page>
    </Document>
  )
}

export async function generateInvoicePdfBase64(data: InvoicePdfData): Promise<string> {
  const buffer = await renderToBuffer(InvoiceDocument(data) as any)
  return Buffer.from(buffer).toString('base64')
}
