"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Coins, Mail, RefreshCw, Plus, Minus, ShieldCheck } from "lucide-react";
import { adminAPI } from "@/services/api";

type User = { id: number; email: string; isAdmin: number; emailVerified: number; createdAt: string; credits: number };
type Stats = { totalUsers: number; verifiedUsers: number; totalCredits: number; totalEmailsSent: number };

export default function AdminPanel() {
  const [users, setUsers]     = useState<User[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [creditModal, setCreditModal] = useState<{ userId: number; email: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc]     = useState("");
  const [saving, setSaving]             = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminAPI.getUsers(), adminAPI.getStats()])
      .then(([u, s]) => { setUsers(u.data); setStats(s.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCredit = async () => {
    if (!creditModal || !creditAmount) return;
    setSaving(true);
    try {
      await adminAPI.updateCredits(creditModal.userId, parseInt(creditAmount), creditDesc || undefined);
      setCreditModal(null);
      setCreditAmount("");
      setCreditDesc("");
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u => u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Toplam Kullanıcı", value: stats.totalUsers, icon: <Users size={16} className="text-primary" /> },
            { label: "Doğrulanmış", value: stats.verifiedUsers, icon: <ShieldCheck size={16} className="text-primary" /> },
            { label: "Toplam Kredi", value: stats.totalCredits, icon: <Coins size={16} className="text-yellow-500" /> },
            { label: "Gönderilen Mail", value: stats.totalEmailsSent, icon: <Mail size={16} className="text-blue-500" /> },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value.toLocaleString("tr-TR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kullanıcı listesi */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Kullanıcılar</h2>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="E-posta ara..."
              className="px-3 py-1.5 bg-input border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground w-48"
            />
            <button onClick={load} className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Kullanıcı bulunamadı</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(user => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    {user.isAdmin === 1 && (
                      <span className="text-[10px] bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded-full shrink-0">admin</span>
                    )}
                    {user.emailVerified === 0 && (
                      <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">doğrulanmadı</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(user.createdAt).toLocaleDateString("tr-TR")} · {user.credits} kredi
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setCreditModal({ userId: user.id, email: user.email }); setCreditAmount(""); setCreditDesc(""); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Coins size={12} />
                    Kredi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kredi modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Kredi Güncelle</h3>
            <p className="text-xs text-muted-foreground">{creditModal.email}</p>

            <div className="flex gap-2">
              <button
                onClick={() => setCreditAmount(v => v.startsWith("-") ? v.slice(1) : v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors ${!creditAmount.startsWith("-") ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground"}`}
              >
                <Plus size={12} /> Ekle
              </button>
              <button
                onClick={() => setCreditAmount(v => v.startsWith("-") ? v : v ? `-${v}` : "-")}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors ${creditAmount.startsWith("-") ? "bg-destructive/10 text-destructive border-destructive/20" : "border-border text-muted-foreground"}`}
              >
                <Minus size={12} /> Çıkar
              </button>
            </div>

            <input
              type="number"
              value={creditAmount.replace("-", "")}
              onChange={e => setCreditAmount(prev => (prev.startsWith("-") ? `-${e.target.value}` : e.target.value))}
              placeholder="Miktar"
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            <input
              value={creditDesc}
              onChange={e => setCreditDesc(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setCreditModal(null)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground"
              >
                İptal
              </button>
              <button
                onClick={handleCredit}
                disabled={saving || !creditAmount || creditAmount === "-"}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Kaydediliyor..." : "Uygula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
