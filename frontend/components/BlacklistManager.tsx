"use client";
import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldOff, Search, Trash2, Plus, RefreshCw, Clock } from "lucide-react";
import { blacklistAPI } from "@/services/api";

type ListRow = { id: number; email: string; reason?: string; source?: string; createdAt?: string; confirmedAt?: string };
type Stats = { blacklistCount: number; whitelistCount: number; monitoringCount: number };

export default function BlacklistManager() {
  const [tab, setTab] = useState<"black" | "white">("black");
  const [stats, setStats] = useState<Stats>({ blacklistCount: 0, whitelistCount: 0, monitoringCount: 0 });
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const loadStats = useCallback(() => {
    blacklistAPI.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const loadList = useCallback(() => {
    setLoading(true);
    const fn = tab === "black" ? blacklistAPI.getBlacklist : blacklistAPI.getWhitelist;
    fn({ q: q || undefined, limit: 200 })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, q]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);

  const handleRemove = async (id: number) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    const fn = tab === "black" ? blacklistAPI.removeBlacklist : blacklistAPI.removeWhitelist;
    await fn(id).catch(() => {});
    loadStats();
    loadList();
  };

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setAddError("");
    setAdding(true);
    try {
      await blacklistAPI.addBlacklist(addEmail.trim(), addReason.trim() || undefined);
      setAddEmail("");
      setAddReason("");
      loadStats();
      loadList();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg || "Eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (s?: string) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<ShieldOff size={18} className="text-destructive" />}
          label="Kara Liste"
          value={stats.blacklistCount}
          bg="bg-destructive/5 border-destructive/20"
        />
        <StatCard
          icon={<Shield size={18} className="text-primary" />}
          label="Beyaz Liste"
          value={stats.whitelistCount}
          bg="bg-primary/5 border-primary/20"
        />
        <StatCard
          icon={<Clock size={18} className="text-yellow-500" />}
          label="İzleniyor"
          value={stats.monitoringCount}
          bg="bg-yellow-500/5 border-yellow-500/20"
        />
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("black")}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === "black"
                ? "bg-destructive/10 text-destructive border-b-2 border-destructive"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldOff size={14} />
            Kara Liste
            <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
              {stats.blacklistCount}
            </span>
          </button>
          <button
            onClick={() => setTab("white")}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === "white"
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield size={14} />
            Beyaz Liste
            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              {stats.whitelistCount}
            </span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search + Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 bg-input border border-border rounded-lg focus-within:ring-1 focus-within:ring-ring">
              <Search size={14} className="shrink-0 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Email ara..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => { loadStats(); loadList(); }}
              className="p-2.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Manuel ekleme (sadece kara liste) */}
          {tab === "black" && (
            <div className="flex items-start gap-2">
              <input
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Email ekle..."
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
              <input
                value={addReason}
                onChange={e => setAddReason(e.target.value)}
                placeholder="Neden (opsiyonel)"
                className="w-48 px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !addEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Plus size={14} />
                Ekle
              </button>
            </div>
          )}
          {addError && <p className="text-xs text-destructive">{addError}</p>}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              {tab === "black" ? <ShieldOff size={32} className="opacity-20" /> : <Shield size={32} className="opacity-20" />}
              <p className="text-sm">{q ? "Sonuç bulunamadı" : tab === "black" ? "Kara liste boş" : "Beyaz liste boş"}</p>
            </div>
          ) : (
            <div className="space-y-0 border border-border rounded-lg overflow-hidden">
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== rows.length - 1 ? "border-b border-border" : ""} hover:bg-secondary/30 transition-colors`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {row.reason && (
                        <span className="text-xs text-muted-foreground">{row.reason}</span>
                      )}
                      {row.source && row.source !== "manual" && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{row.source}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(row.createdAt || row.confirmedAt)}
                  </span>
                  <button
                    onClick={() => handleRemove(row.id)}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {total > rows.length && (
            <p className="text-xs text-muted-foreground text-center">
              {rows.length} / {total} kayıt gösteriliyor
            </p>
          )}
        </div>
      </div>

      {/* Bounce monitoring info */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <Clock size={16} className="text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Otomatik Bounce Tespiti</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gönderilen her mail 24 saat boyunca izlenir. Bounce (geri dönen) mailler otomatik olarak kara listeye eklenir,
            bounce gelmeyen adresler beyaz listeye eklenir. Şu an <strong>{stats.monitoringCount}</strong> adres izleniyor.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className={`border rounded-xl p-4 flex items-center gap-3 ${bg}`}>
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
