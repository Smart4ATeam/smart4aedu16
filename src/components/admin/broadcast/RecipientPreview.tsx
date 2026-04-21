import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import type { PreviewResult } from "@/lib/broadcast/types";

export function RecipientPreview({ result, loading }: { result: PreviewResult | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <div className="text-sm text-muted-foreground p-3 border rounded">計算中…</div>;
  }
  if (!result) {
    return <div className="text-sm text-muted-foreground p-3 border rounded">請選擇收件人條件</div>;
  }

  const list = expanded ? result.preview : result.sample;

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="w-4 h-4" /> 預計送達 <span className="text-primary">{result.total}</span> 位學員
      </div>
      {result.total > 0 && (
        <>
          <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-auto">
            {list.map((r) => (
              <li key={r.user_id}>• {r.name} {r.member_no ? `(${r.member_no})` : ""}</li>
            ))}
          </ul>
          {result.total > result.sample.length && (
            <button
              type="button"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> 收起</> : <><ChevronDown className="w-3 h-3" /> 展開全部 {result.total} 位</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}
