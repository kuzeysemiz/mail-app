"use client";
import { useState, useEffect, useCallback } from "react";
import { inboxAPI } from "@/services/api";
import { RefreshCw, MailOpen, Trash2, Reply, ChevronLeft, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  fromEmail: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  isRead: number;
}

interface MessageDetail extends Message {
  bodyText: string;
  bodyHtml: string;
  mailboxEmail: string;
  inReplyTo: string | null;
}

interface Props {
  onUnreadChange?: (count: number) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString("tr-TR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function InboxPanel({ onUnreadChange }: Props) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<MessageDetail | null>(null);
  const [loading, setLoading]       = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [replyBody, setReplyBody]   = useState("");
  const [replying, setReplying]     = useState(false);
  const [replyDone, setReplyDone]   = useState(false);
  const [showReply, setShowReply]   = useState(false);
  const LIMIT = 30;

  const fetchMessages = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const r = await inboxAPI.getMessages({ page: p, limit: LIMIT });
      setMessages(r.data.messages);
      setTotal(r.data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(1); }, [fetchMessages]);

  const openMessage = async (msg: Message) => {
    const r = await inboxAPI.getMessage(msg.id);
    setSelected(r.data);
    setShowReply(false);
    setReplyBody("");
    setReplyDone(false);
    if (!msg.isRead) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: 1 } : m));
      const cnt = await inboxAPI.getUnreadCount();
      onUnreadChange?.(cnt.data.count ?? 0);
    }
  };

  const handleMarkAllRead = async () => {
    await inboxAPI.markAllRead();
    setMessages(prev => prev.map(m => ({ ...m, isRead: 1 })));
    onUnreadChange?.(0);
  };

  const handleDelete = async (id: number) => {
    await inboxAPI.delete(id);
    setMessages(prev => prev.filter(m => m.id !== id));
    setTotal(t => t - 1);
    if (selected?.id === id) setSelected(null);
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await inboxAPI.scan();
      await fetchMessages(1);
      const cnt = await inboxAPI.getUnreadCount();
      onUnreadChange?.(cnt.data.count ?? 0);
    } finally {
      setScanning(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !replyBody.trim()) return;
    setReplying(true);
    try {
      await inboxAPI.reply(selected.id, replyBody);
      setReplyDone(true);
      setShowReply(false);
    } finally {
      setReplying(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex h-full gap-0 bg-card border border-border rounded-xl overflow-hidden" style={{ minHeight: 0 }}>
      {/* Left: message list */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selected ? "hidden md:flex md:w-80 shrink-0" : "flex-1"
      )}>
        {/* List header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-medium text-foreground">
            Gelen Kutusu
            {total > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({total})</span>}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMarkAllRead}
              title="Tümünü okundu yap"
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <CheckCheck size={15} />
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              title="Yeni mesajları tara"
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            >
              <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Yükleniyor…</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-2">
              <MailOpen size={28} className="opacity-30" />
              Gelen kutu boş
            </div>
          ) : (
            messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/50 transition-colors",
                  selected?.id === msg.id ? "bg-primary/10" : "hover:bg-secondary/50",
                  !msg.isRead && "bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-sm truncate", !msg.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                    {msg.fromName || msg.fromEmail}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(msg.receivedAt)}</span>
                </div>
                <p className={cn("text-xs truncate mt-0.5", !msg.isRead ? "text-foreground/70" : "text-muted-foreground")}>
                  {msg.subject || "(konu yok)"}
                </p>
                {!msg.isRead && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-1" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
            <button
              disabled={page <= 1}
              onClick={() => fetchMessages(page - 1)}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              ‹ Önceki
            </button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchMessages(page + 1)}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Sonraki ›
            </button>
          </div>
        )}
      </div>

      {/* Right: detail */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Detail header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSelected(null)}
                className="md:hidden p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{selected.subject || "(konu yok)"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}
                  {" · "}{formatDate(selected.receivedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setShowReply(r => !r); setReplyDone(false); }}
                title="Yanıtla"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Reply size={13} />
                Yanıtla
              </button>
              <button
                onClick={() => handleDelete(selected.id)}
                title="Sil"
                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Reply form */}
          {showReply && (
            <div className="px-5 py-3 border-b border-border bg-secondary/20 shrink-0">
              <p className="text-xs text-muted-foreground mb-2">Yanıt — {selected.fromEmail}</p>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                rows={4}
                placeholder="Yanıtınızı yazın…"
                className="w-full text-sm bg-input border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleReply}
                  disabled={replying || !replyBody.trim()}
                  className="px-4 py-1.5 text-xs rounded-md bg-primary text-[oklch(0.11_0.005_260)] font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {replying ? "Gönderiliyor…" : "Gönder"}
                </button>
                <button onClick={() => setShowReply(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  İptal
                </button>
              </div>
            </div>
          )}

          {replyDone && (
            <div className="px-5 py-2 text-xs text-green-500 bg-green-500/10 border-b border-green-500/20 shrink-0">
              Yanıt gönderildi.
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {selected.bodyHtml ? (
              <iframe
                srcDoc={selected.bodyHtml}
                sandbox="allow-same-origin"
                className="w-full border-0 rounded"
                style={{ minHeight: 400, height: "100%" }}
                onLoad={e => {
                  const f = e.currentTarget;
                  try { f.style.height = f.contentDocument!.body.scrollHeight + "px"; } catch {}
                }}
              />
            ) : (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{selected.bodyText || "(içerik yok)"}</pre>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <MailOpen size={32} className="opacity-20" />
            Bir mesaj seçin
          </div>
        </div>
      )}
    </div>
  );
}
