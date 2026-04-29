import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";

// Register Noto Sans TC for Chinese support
Font.register({
  family: "NotoSansTC",
  fonts: [
    {
      src: "https://fonts.gstatic.com/ea/notosanstc/v1/NotoSansTC-Regular.otf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/ea/notosanstc/v1/NotoSansTC-Bold.otf",
      fontWeight: "bold",
    },
  ],
});

export interface PaymentDocumentData {
  doc_no: string;
  generated_at: string; // ISO
  service_period: string;
  service_description: string;
  gross_amount: number;
  withholding_tax: number;
  nhi_supplement: number;
  net_amount: number;
  payee: {
    name: string;
    id_number: string;
    registered_address: string;
    bank_name: string;
    branch_name?: string | null;
    account_number: string;
    account_name: string;
  };
  signature_data_url?: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "NotoSansTC",
    fontSize: 10,
    color: "#111",
  },
  header: { textAlign: "center", marginBottom: 16 },
  company: { fontSize: 11, marginBottom: 2 },
  title: { fontSize: 18, fontWeight: "bold", marginVertical: 4 },
  meta: { fontSize: 9, color: "#444" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    backgroundColor: "#f0f0f0",
    padding: 4,
    marginBottom: 4,
  },
  table: { borderTop: "1pt solid #999", borderLeft: "1pt solid #999" },
  row: { flexDirection: "row" },
  cellLabel: {
    width: "28%",
    padding: 4,
    backgroundColor: "#fafafa",
    borderRight: "1pt solid #999",
    borderBottom: "1pt solid #999",
    fontWeight: "bold",
  },
  cellValue: {
    width: "72%",
    padding: 4,
    borderRight: "1pt solid #999",
    borderBottom: "1pt solid #999",
  },
  amountRow: { flexDirection: "row", borderBottom: "1pt solid #999" },
  amountLabel: {
    width: "70%",
    padding: 4,
    borderRight: "1pt solid #999",
    backgroundColor: "#fafafa",
  },
  amountValue: { width: "30%", padding: 4, textAlign: "right" },
  amountValueBold: {
    width: "30%",
    padding: 4,
    textAlign: "right",
    fontWeight: "bold",
    backgroundColor: "#fff8e1",
  },
  signRow: {
    flexDirection: "row",
    marginTop: 24,
    justifyContent: "space-between",
  },
  signBox: {
    width: "45%",
    height: 90,
    border: "1pt solid #999",
    padding: 4,
  },
  signLabel: { fontSize: 9, color: "#666" },
  signImage: { maxHeight: 70, marginTop: 4, objectFit: "contain" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 8,
    color: "#888",
  },
});

function formatTW(iso: string): string {
  const d = new Date(iso);
  // Force UTC+8
  const t = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const day = String(t.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function nt(n: number): string {
  return "NT$ " + n.toLocaleString("en-US");
}

export function PaymentDocumentPDF({ data }: { data: PaymentDocumentData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>禹動科技整合股份有限公司 Smart4A</Text>
          <Text style={styles.title}>勞務報酬單</Text>
          <Text style={styles.meta}>
            單號：{data.doc_no}　製表日期：{formatTW(data.generated_at)}
          </Text>
          <Text style={styles.meta}>所得類別：9A 執行業務所得</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>受款人資料</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>姓名</Text>
              <Text style={styles.cellValue}>{data.payee.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>身分證字號</Text>
              <Text style={styles.cellValue}>{data.payee.id_number}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>戶籍地址</Text>
              <Text style={styles.cellValue}>{data.payee.registered_address}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>匯款銀行</Text>
              <Text style={styles.cellValue}>
                {data.payee.bank_name}
                {data.payee.branch_name ? ` ${data.payee.branch_name}` : ""}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>戶名</Text>
              <Text style={styles.cellValue}>{data.payee.account_name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>帳號</Text>
              <Text style={styles.cellValue}>{data.payee.account_number}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服務內容</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>服務期間</Text>
              <Text style={styles.cellValue}>{data.service_period}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>服務項目</Text>
              <Text style={styles.cellValue}>{data.service_description}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>金額明細</Text>
          <View style={{ borderTop: "1pt solid #999", borderLeft: "1pt solid #999", borderRight: "1pt solid #999" }}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>應領金額（給付總額）</Text>
              <Text style={styles.amountValue}>{nt(data.gross_amount)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>代扣所得稅（10%，未達 20,010 不扣）</Text>
              <Text style={styles.amountValue}>- {nt(data.withholding_tax)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>二代健保補充保費（2.11%，未達 20,000 不扣）</Text>
              <Text style={styles.amountValue}>- {nt(data.nhi_supplement)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>實付金額</Text>
              <Text style={styles.amountValueBold}>{nt(data.net_amount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>受款人簽名</Text>
            {data.signature_data_url ? (
              <Image src={data.signature_data_url} style={styles.signImage} />
            ) : (
              <Text style={{ marginTop: 30, textAlign: "center", color: "#bbb" }}>
                （請於系統內簽名後上傳）
              </Text>
            )}
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>給付單位</Text>
            <Text style={{ marginTop: 8 }}>禹動科技整合股份有限公司</Text>
            <Text>Smart4A</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          本單據由 Smart4A 系統自動產生 · 禹動科技整合股份有限公司
        </Text>
      </Page>
    </Document>
  );
}
