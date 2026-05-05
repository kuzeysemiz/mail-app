"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { inboxAPI } from "@/services/api";
import { RefreshCw, MailOpen, Trash2, Reply, ChevronLeft, CheckCheck, Mail } from "lucide-react";
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
  autoOpenUnread?: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString("tr-TR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });
}

const AVATAR_COLORS = ["#00c896", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

function avatarColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string, email: string) {
  if (name) return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function InboxPanel({ onUnreadChange, autoOpenUnread }: Props) {
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
  const autoOpenDoneRef             = useRef(false);
  const LIMIT = 30;

  const fetchMessages = useCallback(async (p = 1): Promise<Message[]> => {
    setLoading(true);
    try {
      const r = await inboxAPI.getMessages({ page: p, limit: LIMIT });
      setMessages(r.data.messages);
      setTotal(r.data.total);
      setPage(p);
      return r.data.messages as Message[];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages(1).then(msgs => {
      if (autoOpenUnread && !autoOpenDoneRef.current) {
        autoOpenDoneRef.current = true;
        const first = msgs.find(m => !m.isRead);
        if (first) openMessage(first);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMessages]);

  const openMessage = async (msg: Message) => {
    try {
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
    } catch (err) {
      console.error("Mesaj açılamadı:", err);
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
    <div className="flex flex-1 min-h-0 gap-0 overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>

      {/* ── Sol: mesaj listesi ── */}
      <div className={cn(
        "flex flex-col min-h-0",
        selected ? "hidden md:flex shrink-0" : "flex-1"
      )} style={{ width: selected ? 300 : undefined, borderRight: "1px solid var(--border)" }}>

        {/* Liste başlığı */}
        <div className="flex items-center justify-between shrink-0"
          style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--card2)" }}>
          <div className="flex items-center gap-2">
            <Mail size={14} style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Gelen Kutusu</span>
            {total > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>({total})</span>}
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={handleMarkAllRead} title="Tümünü okundu yap"
              style={{ padding: "6px", borderRadius: 6, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <CheckCheck size={14} />
            </button>
            <button onClick={handleScan} disabled={scanning} title="Yeni mesajları tara"
              style={{ padding: "6px", borderRadius: 6, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", opacity: scanning ? 0.4 : 1 }}
              onMouseEnter={e => { if (!scanning) { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Mesaj listesi (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading && messages.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, fontSize: 13, color: "var(--muted)" }}>
              Yükleniyor…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, gap: 10, color: "var(--muted)" }}>
              <MailOpen size={30} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: 13 }}>Gelen kutu boş</span>
            </div>
          ) : messages.map(msg => {
            const color = avatarColor(msg.fromEmail);
            const init = initials(msg.fromName, msg.fromEmail);
            const isSelected = selected?.id === msg.id;
            const isUnread = !msg.isRead;
            return (
              <button key={msg.id} onClick={() => openMessage(msg)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start",
                  gap: 10, padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: isSelected ? `3px solid var(--primary)` : "3px solid transparent",
                  background: isSelected ? "rgba(0,200,150,0.08)" : isUnread ? "rgba(255,255,255,0.02)" : "transparent",
                  cursor: "pointer", border: "none", outline: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--card2)"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = isUnread ? "rgba(255,255,255,0.02)" : "transparent"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: color + "20", color, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 700, marginTop: 2,
                }}>
                  {init}
                </div>
                {/* İçerik */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontWeight: isUnread ? 600 : 500,
                      color: isUnread ? "var(--text)" : "rgba(243,244,246,0.6)",
                    }}>
                      {msg.fromName || msg.fromEmail}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{formatDate(msg.receivedAt)}</span>
                  </div>
                  <p style={{
                    fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isUnread ? "rgba(243,244,246,0.75)" : "var(--muted)",
                    margin: 0,
                  }}>
                    {msg.subject || "(konu yok)"}
                  </p>
                </div>
                {/* Okunmamış nokta */}
                {isUnread && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", flexShrink: 0, marginTop: 6 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
            <button disabled={page <= 1} onClick={() => fetchMessages(page - 1)}
              style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.3 : 1 }}>
              ‹ Önceki
            </button>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => fetchMessages(page + 1)}
              style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.3 : 1 }}>
              Sonraki ›
            </button>
          </div>
        )}
      </div>

      {/* ── Sağ: mesaj detayı ── */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>

          {/* Detay başlığı */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                <button onClick={() => setSelected(null)}
                  className="md:hidden"
                  style={{ padding: 4, borderRadius: 6, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
                  <ChevronLeft size={18} />
                </button>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  background: avatarColor(selected.fromEmail) + "20",
                  color: avatarColor(selected.fromEmail),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700,
                }}>
                  {initials(selected.fromName, selected.fromEmail)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selected.subject || "(konu yok)"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    {selected.fromName
                      ? <><span style={{ color: "rgba(243,244,246,0.8)" }}>{selected.fromName}</span>{" "}<span>&lt;{selected.fromEmail}&gt;</span></>
                      : selected.fromEmail
                    }
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Alıcı: {selected.mailboxEmail}</span>
                    <span style={{ color: "var(--border)", fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(selected.receivedAt)}</span>
                  </div>
                </div>
              </div>
              {/* Aksiyonlar */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button onClick={() => { setShowReply(r => !r); setReplyDone(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                    fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: "pointer",
                    background: "rgba(0,200,150,0.12)", color: "var(--primary)",
                    border: "1px solid rgba(0,200,150,0.2)", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.12)"; }}>
                  <Reply size={13} />Yanıtla
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  style={{ padding: "6px", borderRadius: 6, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Yanıt formu */}
          {showReply && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                Yanıt → <span style={{ color: "rgba(243,244,246,0.85)" }}>{selected.fromEmail}</span>
              </p>
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={4}
                placeholder="Yanıtınızı yazın…"
                style={{
                  width: "100%", fontSize: 13, background: "var(--input)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "10px 12px", color: "var(--text)", resize: "none",
                  outline: "none", fontFamily: "inherit", lineHeight: 1.6,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <button onClick={handleReply} disabled={replying || !replyBody.trim()}
                  style={{
                    padding: "6px 16px", fontSize: 12, fontWeight: 600, borderRadius: 6,
                    background: "var(--primary)", color: "#07090f", border: "none", cursor: "pointer",
                    opacity: replying || !replyBody.trim() ? 0.5 : 1,
                  }}>
                  {replying ? "Gönderiliyor…" : "Gönder"}
                </button>
                <button onClick={() => setShowReply(false)}
                  style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>
                  İptal
                </button>
              </div>
            </div>
          )}

          {replyDone && (
            <div style={{ padding: "8px 20px", fontSize: 12, color: "#22c55e", background: "rgba(34,197,94,0.08)", borderBottom: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <CheckCheck size={13} />Yanıt başarıyla gönderildi.
            </div>
          )}

          {/* Mesaj içeriği */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {selected.bodyHtml ? (
              <div style={{ padding: 16 }}>
                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "#fff" }}>
                  <iframe
                    srcDoc={selected.bodyHtml}
                    sandbox=""
                    style={{ width: "100%", border: "none", display: "block", minHeight: 300, height: 1 }}
                    onLoad={e => {
                      const f = e.currentTarget;
                      try {
                        const h = f.contentDocument?.documentElement.scrollHeight ?? f.contentDocument?.body.scrollHeight ?? 300;
                        f.style.height = Math.max(h, 100) + "px";
                      } catch { f.style.height = "400px"; }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
                  <pre style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7, margin: 0 }}>
                    {selected.bodyText || "(içerik yok)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
          className="hidden md:flex">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--muted)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MailOpen size={24} style={{ opacity: 0.3 }} />
            </div>
            <p style={{ fontSize: 13 }}>Okumak için bir mesaj seçin</p>
          </div>
        </div>
      )}
    </div>
  );
}
