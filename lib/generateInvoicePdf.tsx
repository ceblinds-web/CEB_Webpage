import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1C1C1E' },
  headerRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#8B6914', paddingBottom: 10, marginBottom: 14 },
  logo: { width: 40, height: 40, marginRight: 10 },
  brand: { fontSize: 15, color: '#8B6914', fontWeight: 700 },
  tagline: { fontSize: 7, color: '#888' },
  h1: { fontSize: 13, marginBottom: 3, fontWeight: 700 },
  meta: { fontSize: 9, color: '#555', marginBottom: 4 },
  statusBadge: { fontSize: 8, fontWeight: 700, padding: '3 8', color: '#92400E', backgroundColor: '#FEF3C7', alignSelf: 'flex-start', marginBottom: 10 },

  invoiceBox: { backgroundColor: '#FFFBF0', borderWidth: 1, borderColor: '#E8C96B', borderRadius: 4, padding: 10, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceBoxLabel: { fontSize: 9, color: '#4A5568' },
  invoiceBoxValue: { fontSize: 16, fontWeight: 700, color: '#8B6914' },

  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  table: { marginBottom: 12 },
  tr: { flexDirection: 'row' },
  thCell: { backgroundColor: '#1C1C1E', color: '#fff', padding: 5, fontSize: 8, fontWeight: 700 },
  tdCell: { padding: 5, fontSize: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  colLoc: { flex: 2 }, colType: { flex: 1.4 }, colCtrl: { flex: 1.2 }, colFab: { flex: 1.2 }, colQty: { flex: 0.6, textAlign: 'right' }, colAmt: { flex: 1, textAlign: 'right' },

  totalBox: { marginTop: 4, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 240, justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 9, color: '#4A5568' },
  totalValue: { fontSize: 9, fontWeight: 600 },
  grandRow: { flexDirection: 'row', width: 240, justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#C9A84C', paddingTop: 6, marginTop: 4 },
  grandLabel: { fontSize: 12, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700, color: '#8B6914' },

  footer: { marginTop: 24, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee', fontSize: 7, color: '#999', textAlign: 'center' },
})

export type InvoiceLineItem = { location: string; blindType: string; control: string; fabric: string; qty: number; amount: number }

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
  // Full project context, matching what the Invoices tab shows when expanded
  lineItems: InvoiceLineItem[]
  subtotal: number
  discountPct: number
  discountAmount: number
  taxPct: number
  taxAmount: number
  shippingAmount: number
  installationAmount: number
  extraFees: { label: string; amount: number }[]
  grandTotal: number
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
        <Text style={styles.h1}>{d.projectName}</Text>
        <Text style={styles.meta}>{d.customerName}{d.address ? ' · ' + d.address : ''}</Text>

        <View style={styles.invoiceBox}>
          <View>
            <Text style={styles.invoiceBoxLabel}>Invoice {d.invoiceNumber} ({d.invoiceType || 'invoice'}) — {d.pctOfTotal || 0}% of project total</Text>
          </View>
          <Text style={styles.invoiceBoxValue}>{fmt(d.totalAmount)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Project Items</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.thCell, styles.colLoc]}>Location</Text>
            <Text style={[styles.thCell, styles.colType]}>Blind Type</Text>
            <Text style={[styles.thCell, styles.colCtrl]}>Control</Text>
            <Text style={[styles.thCell, styles.colFab]}>Fabric</Text>
            <Text style={[styles.thCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.thCell, styles.colAmt]}>Amount</Text>
          </View>
          {d.lineItems.map((item, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.tdCell, styles.colLoc]}>{item.location || '—'}</Text>
              <Text style={[styles.tdCell, styles.colType]}>{item.blindType}</Text>
              <Text style={[styles.tdCell, styles.colCtrl]}>{item.control}</Text>
              <Text style={[styles.tdCell, styles.colFab]}>{item.fabric || '—'}</Text>
              <Text style={[styles.tdCell, styles.colQty]}>{item.qty}</Text>
              <Text style={[styles.tdCell, styles.colAmt]}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(d.subtotal)}</Text>
          </View>
          {d.discountPct > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: '#27AE60' }]}>Discount ({d.discountPct}%)</Text>
              <Text style={[styles.totalValue, { color: '#27AE60' }]}>-{fmt(d.discountAmount)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({d.taxPct}%)</Text>
            <Text style={styles.totalValue}>{fmt(d.taxAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Shipping</Text>
            <Text style={styles.totalValue}>{fmt(d.shippingAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Installation</Text>
            <Text style={styles.totalValue}>{fmt(d.installationAmount)}</Text>
          </View>
          {d.extraFees.map((f, i) => (
            <View style={styles.totalRow} key={i}>
              <Text style={styles.totalLabel}>{f.label}</Text>
              <Text style={styles.totalValue}>{fmt(f.amount)}</Text>
            </View>
          ))}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>PROJECT GRAND TOTAL</Text>
            <Text style={styles.grandValue}>{fmt(d.grandTotal)}</Text>
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
