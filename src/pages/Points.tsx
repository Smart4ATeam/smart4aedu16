import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, TrendingUp, TrendingDown, Minus, Award, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Points() {
  const { user } = useAuth();

  // Find member by user email or user_id
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ["my-member", user?.id],
    enabled: !!user,
    queryFn: async () => {
      let { data } = await supabase
        .from("reg_members" as any)
        .select("id, name, member_no, points, task_points")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) return data as any;

      if (user!.email) {
        const res = await supabase
          .from("reg_members" as any)
          .select("id, name, member_no, points, task_points")
          .eq("email", user!.email)
          .maybeSingle();
        return res.data as any;
      }
      return null;
    },
  });

  // 收益（總現金）
  const { data: profile } = useQuery({
    queryKey: ["my-profile-revenue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("total_revenue").eq("id", user!.id).maybeSingle();
      return data;
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
        .limit(200);
      return (data || []) as any[];
    },
  });

  const typeLabels: Record<string, string> = {
    manual: "手動發放",
    awarded: "課程給點",
    earned: "獎勵",
    redeemed: "兌換扣點",
    adjusted: "調整",
    referral: "推薦獎勵",
    cancelled: "取消扣回",
    "任務完成": "任務完成",
    "Agent發放": "Agent 發放",
    "Agent調整": "Agent 調整",
  };

  const isLoading = memberLoading || txLoading;

  const pointsTx = transactions.filter((t) => (t.category ?? "points") === "points");
  const taskTx = transactions.filter((t) => t.category === "task_points");

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>類型</TableHead>
          <TableHead>說明</TableHead>
          <TableHead className="w-24 text-right">數值</TableHead>
          <TableHead className="w-32">時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">載入中...</TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">尚無紀錄</TableCell>
          </TableRow>
        ) : rows.map((tx: any) => (
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
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">我的點數 / 積分 / 收益</h1>
        <p className="text-muted-foreground text-sm mt-1">
          點數來自上課、報名等學習活動；積分由接案任務累積；收益為任務的現金獎勵。
        </p>
      </div>

      {/* 三張卡 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Coins className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">點數（學習）</p>
            <p className="text-3xl font-bold text-foreground">
              {member ? Number(member.points || 0).toLocaleString() : "—"}
            </p>
            {member?.member_no && (
              <p className="text-[11px] text-muted-foreground mt-0.5">學號：{member.member_no}</p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <Award className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">積分（接案）</p>
            <p className="text-3xl font-bold text-foreground">
              {member ? Number(member.task_points || 0).toLocaleString() : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">接案累積，非現金</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center">
            <DollarSign className="w-7 h-7 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">收益（現金）</p>
            <p className="text-3xl font-bold text-foreground">
              ${profile ? Number(profile.total_revenue || 0).toLocaleString() : "0"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">任務完成累計</p>
          </div>
        </div>
      </div>

      {!member && !isLoading && (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <p>尚未找到您的報名學員資料，如有疑問請聯繫管理員。</p>
        </div>
      )}

      {member && (
        <div className="glass-card rounded-xl overflow-hidden">
          <Tabs defaultValue="points">
            <div className="px-5 pt-4 border-b border-border">
              <TabsList>
                <TabsTrigger value="points">點數紀錄 ({pointsTx.length})</TabsTrigger>
                <TabsTrigger value="task">積分紀錄 ({taskTx.length})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="points" className="m-0">{renderTable(pointsTx)}</TabsContent>
            <TabsContent value="task" className="m-0">{renderTable(taskTx)}</TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
