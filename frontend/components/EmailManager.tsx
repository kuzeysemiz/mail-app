"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { List, LayoutGrid, Send, Trash2, Edit2, FileDown, CheckSquare, Zap, ChevronLeft, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { mailboxAPI, emailAPI, settingsAPI } from "@/services/api";

const ReactQuill = dynamic(() => import("./QuillEditor"), { ssr: false });

const QUILL_MODULES = { toolbar: [["bold","italic","underline"],["link","image"],["clean"]], imageResize: { modules: ["Resize", "DisplaySize"] } };
const QUILL_FORMATS = ["bold","italic","underline","link","image"];

interface Mailbox { id: number; email: string; }
interface Batch { batchId: string; mailSubject: string; totalCount: number; sentCount: number; pendingCount: number; failedCount: number; createdAt: string; }
interface Email  { id: number; recipientEmail: string; mailSubject: string; mailContent: string; mailSignature: string; scheduledDate: string; scheduledTime: string; status: string; batchId: string; }

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = { sent: "bg-primary/10 text-primary border-primary/20", pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", failed: "bg-destructive/10 text-destructive border-destructive/20" } as Record<string, string>;
  const lbl = { sent: "Gönderildi", pending: "Bekliyor", failed: "Başarısız" } as Record<string, string>;
  return <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border", cfg[status] || "bg-secondary text-muted-foreground border-border")}>{lbl[status] || status}</span>;
};

export default function EmailManager() {
  const [mailboxes, setMailboxes]     = useState<Mailbox[]>([]);
  const [selected, setSelected]       = useState("");
  const [viewMode, setViewMode]       = useState<"batches"|"emails">("batches");
  const [batches, setBatches]         = useState<Batch[]>([]);
  const [emails, setEmails]           = useState<Email[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [filter, setFilter]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState({ text: "", type: "" });
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editData, setEditData]       = useState<Partial<Email>>({});
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchData, setEditBatchData]   = useState({ mailSubject: "", mailContent: "", mailSignature: "" });
  const [renamingBatchId, setRenamingBatchId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sendOverdue, setSendOverdue] = useState(false);

  useEffect(() => {
    mailboxAPI.getAll().then(r => {
      setMailboxes(r.data);
      if (r.data.length > 0) setSelected(String(r.data[0].id));
    }).catch(() => {});
    settingsAPI.get("send_overdue").then(r => setSendOverdue(r.data.value === "true")).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) loadBatches();
  }, [selected]);

  const showMessage = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 3000); };

  const loadBatches = async () => {
    if (!selected) return;
    setLoading(true);
    try { const r = await emailAPI.getBatches(selected); setBatches(r.data); } catch {}
    setLoading(false);
  };

  const loadEmails = async (batchId?: string) => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = batchId ? await emailAPI.getBatchEmails(batchId) : await emailAPI.getByMailbox(selected, filter || undefined);
      setEmails(r.data);
    } catch {}
    setLoading(false);
  };

  const openBatch = (batch: Batch) => { setSelectedBatch(batch); setViewMode("emails"); loadEmails(batch.batchId); };

  const handleDelete = async (id: number) => {
    if (!confirm("Sil?")) return;
    try { await emailAPI.delete(id); showMessage("Email silindi", "success"); loadEmails(selectedBatch?.batchId); } catch { showMessage("Hata", "error"); }
  };
  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Tüm batch silinsin mi?")) return;
    try { await emailAPI.deleteBatch(batchId); showMessage("Batch silindi", "success"); loadBatches(); } catch { showMessage("Hata", "error"); }
  };
  const handleSendNow = async (id: number) => {
    try { await emailAPI.sendNow(id); showMessage("Email gönderildi", "success"); loadEmails(selectedBatch?.batchId); } catch (err: any) { showMessage(err.response?.data?.error || "Hata", "error"); }
  };
  const handleSendBatchNow = async (batchId: string) => {
    try { const r = await emailAPI.sendBatchNow(batchId); showMessage(r.data.message, "success"); loadBatches(); } catch { showMessage("Hata", "error"); }
  };

  const handleSaveEdit = async (id: number) => {
    try { await emailAPI.update(id, editData); showMessage("Güncellendi", "success"); setEditingId(null); loadEmails(selectedBatch?.batchId); } catch { showMessage("Hata", "error"); }
  };
  const handleSaveBatchEdit = async (batchId: string) => {
    try { await emailAPI.updateBatch(batchId, editBatchData.mailSubject, editBatchData.mailContent, editBatchData.mailSignature); showMessage("Batch güncellendi", "success"); setEditingBatchId(null); loadBatches(); } catch { showMessage("Hata", "error"); }
  };
  const handleRename = async (batchId: string) => {
    try { await emailAPI.updateBatch(batchId, renameValue, "", ""); showMessage("İsim güncellendi", "success"); setRenamingBatchId(null); loadBatches(); } catch { showMessage("Hata", "error"); }
  };

  const handleDownloadPDF = async (batch: Batch) => {
    try {
      const r = await emailAPI.getBatchEmails(batch.batchId);
      const rows = r.data.map((e: Email) => `<tr><td>${e.recipientEmail}</td><td>${e.scheduledDate} ${e.scheduledTime}</td><td>${e.status}</td></tr>`).join("");
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`<html><head><title>${batch.mailSubject}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h2>${batch.mailSubject}</h2><p>Toplam: ${batch.totalCount} | Gönderildi: ${batch.sentCount} | Bekliyor: ${batch.pendingCount}</p><table><tr><th>Email</th><th>Zamanlama</th><th>Durum</th></tr>${rows}</table></body></html>`);
      win.document.close(); win.print();
    } catch { showMessage("PDF hatası", "error"); }
  };

  return (
    <div className="space-y-6">
      {msg.text && (
        <div className={`px-5 py-4 rounded-xl text-sm border ${msg.type === "success" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>{msg.text}</div>
      )}

      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="flex-1 min-w-0 px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">-- Hesap Seçin --</option>
            {mailboxes.map(mb => <option key={mb.id} value={mb.id}>{mb.email}</option>)}
          </select>

          {viewMode === "emails" && (
            <select value={filter} onChange={e => { setFilter(e.target.value); loadEmails(selectedBatch?.batchId); }}
              className="px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Tüm Durumlar</option>
              <option value="pending">Bekliyor</option>
              <option value="sent">Gönderildi</option>
              <option value="failed">Başarısız</option>
            </select>
          )}

          {viewMode === "emails" && (
            <button onClick={() => { setViewMode("batches"); setSelectedBatch(null); loadBatches(); }}
              className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border text-sm text-foreground rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft size={15} />Listelere Dön
            </button>
          )}

          <button onClick={() => viewMode === "batches" ? loadBatches() : loadEmails(selectedBatch?.batchId)}
            className="p-3 bg-secondary border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors">
            <RefreshCw size={15} />
          </button>

          <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={sendOverdue} onChange={async e => { setSendOverdue(e.target.checked); await settingsAPI.set("send_overdue", String(e.target.checked)); }} className="accent-primary w-4 h-4" />
            Zamanı geçmişleri gönder
          </label>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>}

      {/* Batch view */}
      {!loading && viewMode === "batches" && (
        <div className="space-y-4">
          {batches.length === 0 && (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
              <List size={40} className="mx-auto mb-4 opacity-20" /><p className="text-sm">Henüz email listesi yok</p>
            </div>
          )}
          {batches.map(batch => (
            <div key={batch.batchId} className="bg-card border border-border rounded-xl p-6">
              {editingBatchId === batch.batchId ? (
                <div className="space-y-4">
                  <input value={editBatchData.mailSubject} onChange={e => setEditBatchData(p => ({...p, mailSubject: e.target.value}))}
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Başlık" />
                  <ReactQuill value={editBatchData.mailContent} onChange={v => setEditBatchData(p => ({...p, mailContent: v}))} modules={QUILL_MODULES} formats={QUILL_FORMATS} theme="snow" />
                  <div className="flex gap-3">
                    <button onClick={() => handleSaveBatchEdit(batch.batchId)} className="px-5 py-2.5 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90">Kaydet</button>
                    <button onClick={() => setEditingBatchId(null)} className="px-5 py-2.5 bg-secondary border border-border text-foreground rounded-lg text-sm hover:bg-muted">İptal</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    {renamingBatchId === batch.batchId ? (
                      <div className="flex gap-2 mb-3">
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
                          className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                        <button onClick={() => handleRename(batch.batchId)} className="px-3 py-2 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold">✓</button>
                        <button onClick={() => setRenamingBatchId(null)} className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-foreground truncate">{batch.mailSubject || batch.batchId}</p>
                        <button onClick={() => { setRenamingBatchId(batch.batchId); setRenameValue(batch.mailSubject || ""); }}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"><Edit2 size={13} /></button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mb-4">{new Date(batch.createdAt).toLocaleDateString("tr-TR")}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-3 py-1 bg-secondary rounded-full text-muted-foreground">Toplam: {batch.totalCount}</span>
                      {batch.sentCount > 0    && <span className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full">Gönderildi: {batch.sentCount}</span>}
                      {batch.pendingCount > 0 && <span className="text-xs px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full">Bekliyor: {batch.pendingCount}</span>}
                      {batch.failedCount > 0  && <span className="text-xs px-3 py-1 bg-destructive/10 text-destructive rounded-full">Başarısız: {batch.failedCount}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={() => openBatch(batch)} className="flex items-center gap-1.5 px-4 py-2 bg-secondary border border-border text-sm text-foreground rounded-lg hover:bg-muted transition-colors"><LayoutGrid size={14} />Detaylar</button>
                    {batch.pendingCount > 0 && <button onClick={() => handleSendBatchNow(batch.batchId)} className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm hover:bg-primary/20 transition-colors"><Zap size={14} />Hemen Gönder</button>}
                    <button onClick={() => { setEditingBatchId(batch.batchId); setEditBatchData({ mailSubject: batch.mailSubject, mailContent: "", mailSignature: "" }); }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-border"><Edit2 size={15} /></button>
                    <button onClick={() => handleDownloadPDF(batch)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-border"><FileDown size={15} /></button>
                    <button onClick={() => handleDeleteBatch(batch.batchId)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-border"><Trash2 size={15} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Email list view */}
      {!loading && viewMode === "emails" && (
        <div className="space-y-3">
          {selectedBatch && (
            <div className="bg-secondary border border-border rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedBatch.mailSubject || selectedBatch.batchId}</p>
                <p className="text-xs text-muted-foreground mt-1">{emails.length} email</p>
              </div>
              {selectedBatch.pendingCount > 0 && (
                <button onClick={() => handleSendBatchNow(selectedBatch.batchId)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm hover:bg-primary/20 transition-colors">
                  <Zap size={14} />Tümünü Gönder
                </button>
              )}
            </div>
          )}

          {emails.length === 0 && (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
              <Send size={40} className="mx-auto mb-4 opacity-20" /><p className="text-sm">Email yok</p>
            </div>
          )}

          {emails.map(email => (
            <div key={email.id} className="bg-card border border-border rounded-xl p-5">
              {editingId === email.id ? (
                <div className="space-y-4">
                  <input value={editData.recipientEmail || ""} onChange={e => setEditData(p => ({...p, recipientEmail: e.target.value}))}
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Email" />
                  <input value={editData.mailSubject || ""} onChange={e => setEditData(p => ({...p, mailSubject: e.target.value}))}
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Başlık" />
                  <div className="flex gap-3">
                    <input type="date" value={editData.scheduledDate || ""} onChange={e => setEditData(p => ({...p, scheduledDate: e.target.value}))}
                      className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    <input type="time" value={editData.scheduledTime || ""} onChange={e => setEditData(p => ({...p, scheduledTime: e.target.value}))}
                      className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleSaveEdit(email.id)} className="px-5 py-2.5 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90">Kaydet</button>
                    <button onClick={() => setEditingId(null)} className="px-5 py-2.5 bg-secondary border border-border text-foreground rounded-lg text-sm hover:bg-muted">İptal</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{email.recipientEmail}</p>
                      <StatusBadge status={email.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{email.mailSubject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{email.scheduledDate} {email.scheduledTime}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditingId(email.id); setEditData({ recipientEmail: email.recipientEmail, mailSubject: email.mailSubject, scheduledDate: email.scheduledDate, scheduledTime: email.scheduledTime }); }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-border"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(email.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-border"><Trash2 size={14} /></button>
                    {email.status === "pending" && (
                      <button onClick={() => handleSendNow(email.id)} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs hover:bg-primary/20 transition-colors"><Zap size={13} />Gönder</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
