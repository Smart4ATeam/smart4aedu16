import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Search, Bell, Star, Archive, Send, Paperclip, MoreVertical, CheckCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ConversationItem {
  id: string;
  title: string;
  category: string;
  updated_at: string;
  unread: boolean;
  starred: boolean;
  archived: boolean;
  lastMessage?: string;
}

interface MessageItem {
  id: string;
  content: string;
  sender_id: string | null;
  is_system: boolean;
  created_at: string;
}

const categoryLabels: Record<string, { label: string; color: string; avatar: string }> = {
  system: { label: "系統", color: "bg-accent/20 text-accent", avatar: "🔔" },
  client: { label: "客戶", color: "bg-primary/20 text-primary", avatar: "🏢" },
  team: { label: "團隊", color: "bg-success/20 text-success", avatar: "👤" },
};

const filtersConfig = [
  { key: "all", label: "全部", icon: MessageSquare },
  { key: "unread", label: "未讀", icon: Bell },
  { key: "starred", label: "已標星", icon: Star },
  { key: "archived", label: "封存", icon: Archive },
];

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get participant records for this user
    const { data: participants, error: pErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id, unread, starred, archived")
      .eq("user_id", user.id);

    if (pErr || !participants?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participants.map((p) => p.conversation_id);
    const participantMap = new Map(participants.map((p) => [p.conversation_id, p]));

    // Get conversations
    const { data: convs, error: cErr } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (cErr) {
      toast.error("載入對話失敗");
      setLoading(false);
      return;
    }

    // Get latest message per conversation
    const { data: latestMessages } = await supabase
      .from("messages")
      .select("conversation_id, content")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    const lastMsgMap = new Map<string, string>();
    latestMessages?.forEach((m) => {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m.content);
    });

    const items: ConversationItem[] = (convs ?? []).map((c) => {
      const p = participantMap.get(c.id);
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        updated_at: c.updated_at,
        unread: p?.unread ?? false,
        starred: p?.starred ?? false,
        archived: p?.archived ?? false,
        lastMessage: lastMsgMap.get(c.id),
      };
    });

    setConversations(items);
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages when selecting a conversation
  useEffect(() => {
    if (!selectedId) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });

      if (error) toast.error("載入訊息失敗");
      else setMessages(data ?? []);
      setLoadingMessages(false);

      // Mark as read
      if (user) {
        await supabase
          .from("conversation_participants")
          .update({ unread: false })
          .eq("conversation_id", selectedId)
          .eq("user_id", user.id);
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unread: false } : c))
        );
      }
    };
    fetchMessages();
  }, [selectedId, user]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageItem]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  const handleSend = async () => {
    if (!replyText.trim() || !selectedId || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedId,
      content: replyText.trim(),
      sender_id: user.id,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else setReplyText("");
  };

  const handleToggleStar = async (convId: string) => {
    if (!user) return;
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const newStarred = !conv.starred;
    await supabase
      .from("conversation_participants")
      .update({ starred: newStarred })
      .eq("conversation_id", convId)
      .eq("user_id", user.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, starred: newStarred } : c))
    );
  };

  const selected = conversations.find((c) => c.id === selectedId);
  const catInfo = (cat: string) => categoryLabels[cat] ?? categoryLabels.system;

  const filtered = conversations
    .filter((c) => {
      if (activeFilter === "unread") return c.unread;
      if (activeFilter === "starred") return c.starred;
      if (activeFilter === "archived") return c.archived;
      return !c.archived;
    })
    .filter((c) =>
      searchQuery
        ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
        : true
    );

  const unreadCount = conversations.filter((c) => c.unread).length;

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhTW });
    } catch {
      return dateStr;
    }
  };

  const formatMsgTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-2rem)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            💬 訊息中心
            {unreadCount > 0 && (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                {unreadCount} 則未讀
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">管理您的通知、客戶訊息與團隊溝通</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100%-4rem)]">
        {/* Left: Conversation List */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 md:col-span-4 glass-card flex flex-col overflow-hidden"
        >
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="搜尋訊息..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-muted/50 border-border/50"
              />
            </div>
          </div>

          <div className="flex gap-1 p-3 border-b border-border/50">
            {filtersConfig.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                  activeFilter === f.key
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <f.icon className="w-3 h-3" />
                {f.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">沒有對話</div>
            ) : (
              <div className="p-2 space-y-1">
                {filtered.map((conv) => {
                  const cat = catInfo(conv.category);
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                        selectedId === conv.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-base flex-shrink-0">
                          {cat.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-xs font-medium ${conv.unread ? "text-foreground" : "text-muted-foreground"}`}>
                              {conv.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatTime(conv.updated_at)}</span>
                          </div>
                          <p className={`text-[11px] truncate ${conv.unread ? "text-foreground/80" : "text-muted-foreground"}`}>
                            {conv.lastMessage ?? "尚無訊息"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 ${cat.color}`}>
                              {cat.label}
                            </Badge>
                            {conv.unread && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            {conv.starred && <Star className="w-3 h-3 text-warning fill-warning" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </motion.div>

        {/* Right: Message Detail */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 md:col-span-8 glass-card flex flex-col overflow-hidden"
        >
          {selected ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                    {catInfo(selected.category).avatar}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{selected.title}</h3>
                    <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 ${catInfo(selected.category).color}`}>
                      {catInfo(selected.category).label}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleToggleStar(selected.id)}
                  >
                    <Star className={`w-4 h-4 ${selected.starred ? "text-yellow-500 fill-yellow-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">尚無訊息</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const fromMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                              fromMe
                                ? "bg-primary/20 text-foreground rounded-br-md"
                                : "bg-muted/70 text-foreground rounded-bl-md"
                            }`}
                          >
                            <p>{msg.content}</p>
                            <div className={`flex items-center gap-1 mt-1.5 ${fromMe ? "justify-end" : ""}`}>
                              <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
                              {fromMe && <CheckCheck className="w-3 h-3 text-accent" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {selected.category !== "system" && (
                <div className="p-3 border-t border-border/50">
                  <div className="flex items-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Textarea
                      placeholder="輸入訊息..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="min-h-[36px] max-h-[100px] text-xs bg-muted/50 border-border/50 resize-none"
                      rows={1}
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-primary text-primary-foreground flex-shrink-0"
                      onClick={handleSend}
                      disabled={sending || !replyText.trim()}
                    >
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "選擇一個對話開始聊天"}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
