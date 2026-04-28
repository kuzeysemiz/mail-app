"use client";
import { useState, useEffect } from "react";
import { Users, Send, Clock, Mail, Trash2, Plus, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { mailboxAPI, logAPI } from "@/services/api";

interface Mailbox { id: number; email: string; createdAt: string; }

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5" style={{ borderColor: "var(--border)" }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.72 0.19 155 / 0.15)", color: "oklch(0.72 0.19 155)" }}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
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
  const [totalSent, setTotalSent]         = useState(0);
  const [lastActivity, setLastActivity]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [mbRes, sumRes] = await Promise.all([mailboxAPI.getAll(), logAPI.getSummary()]);
      setMailboxes(mbRes.data);
      setTotalSent(sumRes.data?.totalSent ?? 0);
      setLastActivity(sumRes.data?.lastActivity ?? null);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard icon={<Users size={24} />} value={mailboxes.length} label="Bağlı Hesap" />
        <StatCard icon={<Send size={24} />}  value={totalSent}         label="Gönderilen Mail" />
        <StatCard icon={<Clock size={24} />} value={lastActivity ? new Date(lastActivity).toLocaleDateString("tr-TR") : "--"} label="Son Aktivite" />
      </div>

      {/* Alert */}
      {msg.text && (
        <div className={`px-5 py-4 rounded-xl text-sm border ${
          msg.type === "success"
            ? "bg-primary/10 text-primary border-primary/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        }`}>{msg.text}</div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add form */}
        <div className="bg-card border border-border rounded-xl p-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <h2 className="font-semibold text-foreground">Hesap Ekle</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-7">Gmail SMTP üzerinden mail göndermek için yeni hesap ekleyin.</p>

          <form onSubmit={handleAdd} className="space-y-5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                <Mail size={13} /> Gmail Adresi
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ornek@gmail.com"
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                🔑 Uygulama Şifresi
                <span className="normal-case text-primary cursor-help" title="Google hesabınızdan oluşturulan 16 haneli uygulama şifresi">ⓘ</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value.replace(/\s/g, "").slice(0, 16))}
                  placeholder="xxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-11"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{appPassword.length}/16 karakter</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              <Plus size={16} />
              {loading ? "Ekleniyor..." : "Hesabı Ekle"}
            </button>
          </form>

          {/* Instructions */}
          <div className="mt-6 p-5 bg-secondary rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" />
              <span className="text-sm font-medium">Uygulama Şifresi Nasıl Alınır?</span>
            </div>

            <ol className="text-xs text-muted-foreground space-y-2.5">
              <li>1. Google hesabınıza giriş yapın</li>
              <li className="flex items-start gap-1.5">
                <span className="shrink-0">2.</span>
                <span>
                  2 Adımlı Doğrulama aktif olmalı — aktif değilse{" "}
                  <a
                    href="https://myaccount.google.com/signinoptions/two-step-verification"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    buradan etkinleştirin
                  </a>
                </span>
              </li>
              <li>3. Güvenlik ayarlarına gidin</li>
              <li className="flex items-start gap-1.5">
                <span className="shrink-0">4.</span>
                <span>
                  Uygulama şifreleri sayfasını{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    direkt buradan açın
                  </a>
                </span>
              </li>
              <li>5. Yeni uygulama şifresi oluşturun ve kopyalayın</li>
            </ol>

            <div className="flex items-start gap-2 pt-1 border-t border-border/50">
              <span className="text-yellow-400 text-sm shrink-0">⚠</span>
              <p className="text-xs text-muted-foreground">
                2 Adımlı Doğrulama aktif değilse Uygulama Şifreleri seçeneği Google'da görünmez.
              </p>
            </div>
          </div>
        </div>

        {/* Accounts table */}
        <div className="bg-card border border-border rounded-xl p-7">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-primary" />
              <h2 className="font-semibold">Ekli Hesaplar</h2>
            </div>
            <span className="text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-full">
              {mailboxes.length} hesap
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-7">SMTP bağlantısı yapılmış Gmail hesaplarınız.</p>

          {mailboxes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Mail size={40} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">Henüz hesap eklenmedi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Email","Eklenme Tarihi","Durum","İşlem"].map((h, i) => (
                      <th key={h} className={`pb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${i === 3 ? "text-right pr-1" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mailboxes.map(mb => (
                    <tr key={mb.id} className="border-b border-border/40 last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail size={14} className="text-primary" />
                          </div>
                          <span className="truncate max-w-[150px] text-foreground">{mb.email}</span>
                        </div>
                      </td>
                      <td className="py-4 text-muted-foreground whitespace-nowrap">{fmt(mb.createdAt)}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Bağlı
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDelete(mb.id)}
                          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={15} />
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
