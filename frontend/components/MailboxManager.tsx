"use client";
import { useState, useEffect } from "react";
import { Users, Send, Clock, Mail, Trash2, Plus, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { mailboxAPI, logAPI } from "@/services/api";

interface Mailbox { id: number; email: string; createdAt: string; }

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function MailboxManager() {
  const [mailboxes, setMailboxes]     = useState<Mailbox[]>([]);
  const [email, setEmail]             = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState({ text: "", type: "" });
  const [totalSent, setTotalSent]     = useState(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [mbRes, sumRes] = await Promise.all([mailboxAPI.getAll(), logAPI.getSummary()]);
      setMailboxes(mbRes.data);
      setTotalSent(sumRes.data?.totalSent ?? sumRes.data?.successful ?? 0);
    } catch {}
  };

  const showMessage = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return showMessage("Email adresi gerekli", "error");
    if (appPassword.length !== 16) return showMessage("Uygulama şifresi 16 karakter olmalı", "error");
    setLoading(true);
    try {
      await mailboxAPI.create(email, appPassword);
      showMessage("Hesap başarıyla eklendi", "success");
      setEmail(""); setAppPassword("");
      load();
    } catch (err: any) {
      showMessage(err.response?.data?.error || "Hata oluştu", "error");
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu hesabı silmek istiyor musunuz?")) return;
    try {
      await mailboxAPI.delete(id);
      showMessage("Hesap silindi", "success");
      load();
    } catch { showMessage("Silme hatası", "error"); }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Users size={20} />} value={mailboxes.length} label="Bağlı Hesap" />
        <StatCard icon={<Send size={20} />}  value={totalSent}         label="Gönderilen Mail" />
        <StatCard icon={<Clock size={20} />} value="--"               label="Son Aktivite" />
      </div>

      {/* Alert */}
      {msg.text && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          msg.type === "success"
            ? "bg-primary/10 text-primary border-primary/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        }`}>{msg.text}</div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add form */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <h2 className="font-semibold text-foreground">Hesap Ekle</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Gmail SMTP üzerinden mail göndermek için yeni hesap ekleyin.</p>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Mail size={12} /> Gmail Adresi
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ornek@gmail.com"
                className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                🔑 Uygulama Şifresi
                <span className="normal-case text-primary cursor-help" title="Google hesabınızdan oluşturulan 16 haneli uygulama şifresi">ⓘ</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value.replace(/\s/g, "").slice(0, 16))}
                  placeholder="xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{appPassword.length}/16 karakter</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              <Plus size={15} />
              {loading ? "Ekleniyor..." : "Hesabı Ekle"}
            </button>
          </form>

          {/* Instructions */}
          <div className="mt-5 p-4 bg-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-2.5">
              <CheckCircle2 size={16} className="text-primary" />
              <span className="text-sm font-medium">Uygulama Şifresi Nasıl Alınır?</span>
            </div>
            <ol className="text-xs text-muted-foreground space-y-1.5">
              {["Google hesabınıza giriş yapın","Güvenlik ayarlarına gidin","2 Adımlı Doğrulama aktif olmalı","Uygulama şifreleri bölümünü açın","Yeni uygulama şifresi oluşturun"]
                .map((s, i) => <li key={i}>{i+1}. {s}</li>)}
            </ol>
          </div>
        </div>

        {/* Accounts table */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-primary" />
              <h2 className="font-semibold">Ekli Hesaplar</h2>
            </div>
            <span className="text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-full">
              {mailboxes.length} hesap
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">SMTP bağlantısı yapılmış Gmail hesaplarınız.</p>

          {mailboxes.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Mail size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Henüz hesap eklenmedi</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Email","Eklenme Tarihi","Durum","İşlem"].map((h, i) => (
                      <th key={h} className={`pb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${i === 3 ? "text-right pr-1" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mailboxes.map(mb => (
                    <tr key={mb.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail size={13} className="text-primary" />
                          </div>
                          <span className="truncate max-w-[160px] text-foreground">{mb.email}</span>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground whitespace-nowrap">{fmt(mb.createdAt)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Bağlı
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => handleDelete(mb.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
