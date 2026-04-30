import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import { SMART4A_LOGO_BASE64 } from "@/assets/smart4a-logo-base64";

// Register Noto Sans TC from local public assets.
// Remote font URLs can fail inside @react-pdf during download/signature upload.
Font.register({
  family: "NotoSansTC",
  fonts: [
    {
      src: "/fonts/NotoSansCJKtc-Regular.otf",
      fontWeight: "normal",
    },
    {
      src: "/fonts/NotoSansCJKtc-Bold.otf",
      fontWeight: "bold",
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

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
    phone?: string | null;
    bank_name: string;
    branch_name?: string | null;
    account_number: string;
    account_name: string;
  };
  signature_data_url?: string | null;
}

const HEADER_BG = "#5B6478";
const BORDER = "#D9D9D9";
const ROW_ALT = "#F7F7F7";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 56,
    fontFamily: "NotoSansTC",
    fontSize: 10,
    color: "#1A1A1A",
  },

  // Top header
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  logo: { height: 28, objectFit: "contain" },
  topTitle: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },

  // Meta row
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    marginBottom: 14,
  },

  // Section
  section: { marginBottom: 12 },
  sectionTitleBar: {
    backgroundColor: HEADER_BG,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  sectionTitleText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },

  // Generic table
  table: {
    borderLeft: `1pt solid ${BORDER}`,
    borderRight: `1pt solid ${BORDER}`,
    borderBottom: `1pt solid ${BORDER}`,
  },
  row: { flexDirection: "row", borderBottom: `1pt solid ${BORDER}` },
  rowLast: { flexDirection: "row" },

  // Payee/labour cells (label-value pairs, 2 per row)
  pCellLabel: {
    width: "16%",
    padding: 6,
    backgroundColor: ROW_ALT,
    borderRight: `1pt solid ${BORDER}`,
    fontWeight: "bold",
  },
  pCellValue: {
    width: "34%",
    padding: 6,
    borderRight: `1pt solid ${BORDER}`,
  },
  pCellValueLast: {
    width: "34%",
    padding: 6,
  },
  pCellValueFull: {
    width: "84%",
    padding: 6,
  },

  // Amount table (3 cols: 項目 / 金額 / 說明)
  amtHeader: {
    flexDirection: "row",
    backgroundColor: ROW_ALT,
    borderBottom: `1pt solid ${BORDER}`,
  },
  amtHeaderCell: {
    padding: 6,
    fontWeight: "bold",
    borderRight: `1pt solid ${BORDER}`,
  },
  amtRow: { flexDirection: "row", borderBottom: `1pt solid ${BORDER}` },
  amtRowLast: { flexDirection: "row" },
  amtCellItem: {
    width: "30%",
    padding: 6,
    borderRight: `1pt solid ${BORDER}`,
    fontWeight: "bold",
  },
  amtCellValue: {
    width: "30%",
    padding: 6,
    borderRight: `1pt solid ${BORDER}`,
    textAlign: "right",
  },
  amtCellNote: {
    width: "40%",
    padding: 6,
    color: "#555",
  },
  amtRowTotal: {
    backgroundColor: "#FFF8E1",
  },

  // Notes
  notes: { marginTop: 8, marginBottom: 14, fontSize: 9, color: "#555" },
  noteLine: { marginBottom: 2 },

  // Confirm
  confirmBody: {
    borderLeft: `1pt solid ${BORDER}`,
    borderRight: `1pt solid ${BORDER}`,
    borderBottom: `1pt solid ${BORDER}`,
    padding: 12,
    minHeight: 140,
  },
  confirmText: { marginBottom: 18 },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  signBlock: { width: "48%" },
  signLabel: { marginBottom: 6, fontWeight: "bold" },
  signLine: {
    borderBottom: "1pt solid #555",
    height: 28,
    justifyContent: "flex-end",
  },
  signImage: { height: 26, objectFit: "contain" },
  dateLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    fontSize: 10,
  },
  dateBlank: {
    borderBottom: "1pt solid #555",
    width: 36,
    marginHorizontal: 4,
    height: 14,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#777",
    borderTop: `1pt solid ${BORDER}`,
    paddingTop: 6,
  },
});

function formatTwDate(iso: string): string {
  const d = new Date(iso);
  const t = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  const day = t.getUTCDate();
  return `${y}年${m}月${day}日`;
}

function nt(n: number, paren = false): string {
  const s = "NT$ " + Math.abs(n).toLocaleString("en-US");
  return paren ? `(${s})` : s;
}

export function PaymentDocumentPDF({ data }: { data: PaymentDocumentData }) {
  const taxNote =
    data.withholding_tax > 0 ? "扣繳率 10%" : "扣繳率 10%（未達起扣點）";
  const nhiNote =
    data.nhi_supplement > 0 ? "費率 2.11%" : "費率 2.11%（未達起扣點）";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top header */}
        <View style={styles.topHeader}>
          <Image src={SMART4A_LOGO_BASE64} style={styles.logo} />
          <Text style={styles.topTitle}>勞務報酬單</Text>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text>單據編號：{data.doc_no}</Text>
          <Text>製表日期：{formatTwDate(data.generated_at)}</Text>
        </View>

        {/* 領款人資料 */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>領款人資料</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.pCellLabel}>姓名</Text>
              <Text style={styles.pCellValue}>{data.payee.name || "-"}</Text>
              <Text style={styles.pCellLabel}>身分證號</Text>
              <Text style={styles.pCellValueLast}>
                {data.payee.id_number || "-"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.pCellLabel}>戶籍地址</Text>
              <Text style={styles.pCellValueFull}>
                {data.payee.registered_address || "-"}
              </Text>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.pCellLabel}>聯絡電話</Text>
              <Text style={styles.pCellValueFull}>
                {data.payee.phone || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* 勞務內容 */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>勞務內容</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.pCellLabel}>所得期間</Text>
              <Text style={styles.pCellValue}>{data.service_period}</Text>
              <Text style={styles.pCellLabel}>所得類別</Text>
              <Text style={styles.pCellValueLast}>9A 執行業務所得</Text>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.pCellLabel}>勞務說明</Text>
              <Text style={styles.pCellValueFull}>
                {data.service_description || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* 金額明細 */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>金額明細</Text>
          </View>
          <View
            style={{
              borderLeft: `1pt solid ${BORDER}`,
              borderRight: `1pt solid ${BORDER}`,
              borderBottom: `1pt solid ${BORDER}`,
            }}
          >
            <View style={styles.amtHeader}>
              <Text style={[styles.amtHeaderCell, { width: "30%" }]}>項目</Text>
              <Text
                style={[
                  styles.amtHeaderCell,
                  { width: "30%", textAlign: "right" },
                ]}
              >
                金額
              </Text>
              <Text
                style={[
                  styles.amtHeaderCell,
                  { width: "40%", borderRight: "none" },
                ]}
              >
                說明
              </Text>
            </View>

            <View style={styles.amtRow}>
              <Text style={styles.amtCellItem}>應領所得</Text>
              <Text style={styles.amtCellValue}>{nt(data.gross_amount)}</Text>
              <Text style={styles.amtCellNote}>稅前給付總額</Text>
            </View>

            <View style={styles.amtRow}>
              <Text style={styles.amtCellItem}>代扣所得稅</Text>
              <Text style={styles.amtCellValue}>
                {nt(data.withholding_tax, true)}
              </Text>
              <Text style={styles.amtCellNote}>{taxNote}</Text>
            </View>

            <View style={styles.amtRow}>
              <Text style={styles.amtCellItem}>代扣補充保費</Text>
              <Text style={styles.amtCellValue}>
                {nt(data.nhi_supplement, true)}
              </Text>
              <Text style={styles.amtCellNote}>{nhiNote}</Text>
            </View>

            <View style={[styles.amtRowLast, styles.amtRowTotal]}>
              <Text style={styles.amtCellItem}>實付金額</Text>
              <Text
                style={[
                  styles.amtCellValue,
                  { fontWeight: "bold", fontSize: 11 },
                ]}
              >
                {nt(data.net_amount)}
              </Text>
              <Text style={styles.amtCellNote}>應領 − 代扣稅額 − 補充保費</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notes}>
          <Text style={styles.noteLine}>※ 已於職業工會投保者，則免代扣二代健保補充保費。</Text>
          <Text style={styles.noteLine}>※ 外國籍在臺未滿183天者，扣繳率依相關規定另計。</Text>
        </View>

        {/* 領款人確認 */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>領款人確認</Text>
          </View>
          <View style={styles.confirmBody}>
            <Text style={styles.confirmText}>
              本人確認已收到禹動科技整合股份有限公司支付之上述勞務報酬。
            </Text>

            <View style={styles.signRow}>
              <View style={styles.signBlock}>
                <Text style={styles.signLabel}>領款人簽章</Text>
                <View style={styles.signLine}>
                  {data.signature_data_url ? (
                    <Image
                      src={data.signature_data_url}
                      style={styles.signImage}
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.signBlock}>
                <Text style={styles.signLabel}>簽收日期</Text>
                {data.signature_data_url ? (
                  (() => {
                    const now = new Date();
                    const rocYear = now.getFullYear() - 1911;
                    const month = now.getMonth() + 1;
                    const day = now.getDate();
                    return (
                      <View style={styles.dateLine}>
                        <Text>{`民國  ${rocYear}  年  ${month}  月  ${day}  日`}</Text>
                      </View>
                    );
                  })()
                ) : (
                  <View style={styles.dateLine}>
                    <Text>民國</Text>
                    <View style={styles.dateBlank} />
                    <Text>年</Text>
                    <View style={styles.dateBlank} />
                    <Text>月</Text>
                    <View style={styles.dateBlank} />
                    <Text>日</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>禹動科技整合股份有限公司</Text>
          <Text>Smart4A</Text>
        </View>
      </Page>
    </Document>
  );
}
