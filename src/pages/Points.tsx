import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Points() {
  const { user } = useAuth();

  // Find member by user email or user_id
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ["my-member", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Try by user_id first
      let { data } = await supabase
        .from("reg_members" as any)
        .select("id, name, member_no, points")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) return data as any;

      // Fallback: match by email
      if (user!.email) {
        const res = await supabase
          .from("reg_members" as any)
          .select("id, name, member_no, points")
          .eq("email", user!.email)
          .maybeSingle();
        return res.data as any;
      }
      return null;
    },
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["my-point-transactions", member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reg_point_transactions" as any)
        .select("*")
        .eq("member_id", member!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const typeLabels: Record<string, string> = {
    manual: "手動發放",
    awarded: "課程給點",
    redeemed: "兌換扣點",
    adjusted: "調整",
    referral: "推薦獎勵",
    cancelled: "取消扣回",
  };

  const isLoading = memberLoading || txLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">我的點數</h1>
        <p className="text-muted-foreground text-sm mt-1">查看你的點數餘額與異動紀錄</p>
      </div>

      {/* Balance Card */}
      <div className="glass-card rounded-xl p-8 flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Coins className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">目前點數餘額</p>
          <p className="text-4xl font-bold text-foreground">
            {member ? member.points.toLocaleString() : "—"}
          </p>
          {member?.member_no && (
            <p className="text-xs text-muted-foreground mt-1">學員編號：{member.member_no}</p>
          )}
        </div>
      </div>

      {!member && !isLoading && (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <p>尚未找到您的報名學員資料，如有疑問請聯繫管理員。</p>
        </div>
      )}

      {member && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">點數異動紀錄</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>類型</TableHead>
                <TableHead>說明</TableHead>
                <TableHead className="w-24 text-right">點數</TableHead>
                <TableHead className="w-32">時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">載入中...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">尚無點數紀錄</TableCell>
                </TableRow>
              ) : transactions.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {tx.points_delta > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : tx.points_delta < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{typeLabels[tx.type] || tx.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-mono font-bold ${tx.points_delta > 0 ? "text-green-600 dark:text-green-400" : tx.points_delta < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {tx.points_delta > 0 ? "+" : ""}{tx.points_delta}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("zh-TW")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
