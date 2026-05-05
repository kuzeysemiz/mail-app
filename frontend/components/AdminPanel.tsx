"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Coins, Mail, RefreshCw, Plus, Minus, ShieldCheck, Settings, Trash2, Shield, X, Check } from "lucide-react";
import { adminAPI, paddleAPI, creditsAPI } from "@/services/api";

type User = {
  id: number | null;
  email: string;
  isAdmin: number;
  emailVerified: number;
  createdAt: string | null;
  credits: number | null;
  permissions: string | null;
  isFounder?: boolean;
};
type Stats = { totalUsers: number; verifiedUsers: number; totalCredits: number; totalEmailsSent: number };
type Package = { id: number; name: string; slug: string; emailCount: number | null; price: number | null; paddlePriceId: string | null };

const ALL_PERMISSIONS = ["credits", "users", "settings", "stats"] as const;
const DISABLED_PERMISSIONS = new Set(["settings", "stats"]);
const PERM_LABELS: Record<string, string> = {
  credits: "Kredi Yönetimi",
  users: "Kullanıcı Yönetimi",
  settings: "Sistem Ayarları",
  stats: "İstatistikler",
};

function parsePermissions(raw: string | null): string[] | null {
  if (raw === null || raw === undefined) return null;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function AdminPanel({ currentUserId, currentUserPermissions }: {
  currentUserId?: number | null;
  currentUserPermissions?: string[] | null;
}) {
  const [users, setUsers]     = useState<User[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");

  // Kredi modal
  const [creditModal, setCreditModal]   = useState<{ userId: number; email: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc]     = useState("");
  const [creditSent, setCreditSent]     = useState(false);
  const [saving, setSaving]             = useState(false);

  // Silme modal
  const [deleteModal, setDeleteModal]     = useState<{ userId: number; email: string } | null>(null);
  const [deleteActionId, setDeleteActionId] = useState<number | null>(null);
  const [deleteOtp, setDeleteOtp]         = useState("");
  const [deleteStep, setDeleteStep]       = useState<"confirm" | "otp">("confirm");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  // Yetki modal
  const [permModal, setPermModal]       = useState<{ userId: number; email: string } | null>(null);
  const [permIsAdmin, setPermIsAdmin]   = useState(false);
  const [permSelected, setPermSelected] = useState<string[] | null>(null);
  const [permLoading, setPermLoading]   = useState(false);
  const [permSaving, setPermSaving]     = useState(false);

  // Paddle
  const [paddleTab, setPaddleTab]       = useState(false);
  const [packages, setPackages]         = useState<Package[]>([]);
  const [paddleClientToken, setPaddleClientToken] = useState("");
  const [paddleApiKey, setPaddleApiKey] = useState("");
  const [paddleWebhookSecret, setPaddleWebhookSecret] = useState("");
  const [paddleEnv, setPaddleEnv]       = useState<"sandbox" | "production">("sandbox");
  const [paddleSaving, setPaddleSaving] = useState(false);
  const [priceIds, setPriceIds]         = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([adminAPI.getUsers(), adminAPI.getStats()])
      .then(([u, s]) => {
        if (u.status === "fulfilled") setUsers(u.value.data);
        if (s.status === "fulfilled") setStats(s.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!paddleTab) return;
    creditsAPI.getPackages().then(r => {
      setPackages(r.data);
      const ids: Record<string, string> = {};
      r.data.forEach((p: Package) => { ids[p.slug] = p.paddlePriceId || ""; });
      setPriceIds(ids);
    }).catch(() => {});
  }, [paddleTab]);

  // ── Kredi ────────────────────────────────────────────────────────────────────
  const handleCredit = async () => {
    if (!creditModal || !creditAmount) return;
    setSaving(true);
    try {
      await adminAPI.updateCredits(creditModal.userId, parseInt(creditAmount), creditDesc || undefined);
      setCreditSent(true);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const closeCreditModal = () => {
    setCreditModal(null);
    setCreditAmount("");
    setCreditDesc("");
    setCreditSent(false);
  };

  // ── Silme ────────────────────────────────────────────────────────────────────
  const handleDeleteRequest = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const r = await adminAPI.deleteUser(deleteModal.userId);
      setDeleteActionId(r.data.actionId);
      setDeleteStep("otp");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDeleteError(msg || "İstek gönderilemedi");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal || !deleteActionId || !deleteOtp) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await adminAPI.confirmDeleteUser(deleteModal.userId, deleteOtp, deleteActionId);
      closeDeleteModal();
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDeleteError(msg || "Kod hatalı veya süresi dolmuş");
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal(null);
    setDeleteOtp("");
    setDeleteStep("confirm");
    setDeleteActionId(null);
    setDeleteError("");
  };

  // ── Yetki ────────────────────────────────────────────────────────────────────
  const openPermModal = async (user: User) => {
    setPermModal({ userId: user.id, email: user.email });
    setPermIsAdmin(user.isAdmin === 1);
    setPermLoading(true);
    try {
      const r = await adminAPI.getPermissions(user.id);
      // null (eski süper admin) → tüm yetkiler dizisine çevir
      const perms = r.data.permissions;
      setPermSelected(perms === null ? [...ALL_PERMISSIONS] : perms);
    } catch {
      setPermSelected([]);
    } finally {
      setPermLoading(false);
    }
  };

  const handleTogglePerm = (perm: string) => {
    setPermSelected(prev =>
      prev === null ? [perm] : prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePerms = async () => {
    if (!permModal) return;
    setPermSaving(true);
    try {
      const currentIsAdmin = users.find(u => u.id === permModal.userId)?.isAdmin === 1;
      if (permIsAdmin !== currentIsAdmin) await adminAPI.toggleAdmin(permModal.userId);
      // Her zaman dizi kaydet, null (süper admin) kavramı artık yok
      await adminAPI.setPermissions(permModal.userId, permSelected ?? []);
      setPermModal(null);
      load();
    } catch {
    } finally {
      setPermSaving(false);
    }
  };

  // ── Paddle ────────────────────────────────────────────────────────────────────
  const savePaddleConfig = async () => {
    setPaddleSaving(true);
    try {
      await paddleAPI.saveConfig({
        clientToken: paddleClientToken || undefined,
        apiKey: paddleApiKey || undefined,
        webhookSecret: paddleWebhookSecret || undefined,
        environment: paddleEnv,
      });
      for (const [slug, priceId] of Object.entries(priceIds)) {
        if (priceId) await paddleAPI.setPackagePrice(slug, priceId);
      }
    } catch { /* sessiz */ }
    finally { setPaddleSaving(false); }
  };

  const filtered = users.filter(u => u.email.toLowerCase().includes(q.toLowerCase()));

  // Mevcut kullanıcının yetki hesaplamaları
  // currentUserId === null → kurucu admin (tüm yetkiler)
  // currentUserPermissions === null → eski süper admin kaydı (tüm yetkiler)
  const curPerms: string[] = (currentUserId === null || currentUserPermissions === null)
    ? [...ALL_PERMISSIONS]
    : (currentUserPermissions ?? []);
  const isCurrentFullAdmin = ALL_PERMISSIONS.every(p => curPerms.includes(p));
  const canCreditOp        = curPerms.includes("credits");
  const canUserOp          = curPerms.includes("users");

  return (
    <div className="space-y-6">
      {/* Sekme toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPaddleTab(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!paddleTab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
        >
          Kullanıcılar
        </button>
        <button
          onClick={() => setPaddleTab(true)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${paddleTab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
        >
          <Settings size={13} /> Paddle Ayarları
        </button>
      </div>

      {paddleTab ? (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Paddle Anahtarları</h3>
            <p className="text-xs text-muted-foreground">Bu alanları boş bırakırsanız mevcut değerler korunur.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Client Token", value: paddleClientToken, set: setPaddleClientToken, placeholder: "client_live_..." },
                { label: "API Key", value: paddleApiKey, set: setPaddleApiKey, placeholder: "pdl_..." },
                { label: "Webhook Secret", value: paddleWebhookSecret, set: setPaddleWebhookSecret, placeholder: "pdl_ntfset_..." },
              ].map(f => (
                <div key={f.label} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ortam</label>
                <select
                  value={paddleEnv}
                  onChange={e => setPaddleEnv(e.target.value as "sandbox" | "production")}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="sandbox">Sandbox (Test)</option>
                  <option value="production">Production (Canlı)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Paket Price ID&apos;leri</h3>
            <div className="space-y-3">
              {packages.filter(p => p.emailCount).map(pkg => (
                <div key={pkg.slug} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium text-foreground">{pkg.name}</p>
                    <p className="text-[10px] text-muted-foreground">{pkg.emailCount?.toLocaleString("tr-TR")} kredi</p>
                  </div>
                  <input
                    value={priceIds[pkg.slug] || ""}
                    onChange={e => setPriceIds(p => ({ ...p, [pkg.slug]: e.target.value }))}
                    placeholder="pri_..."
                    className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={savePaddleConfig}
            disabled={paddleSaving}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {paddleSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      ) : (
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
                {filtered.map((user, idx) => {
                  const perms = parsePermissions(user.permissions);
                  const permsArr: string[] = perms === null ? [...ALL_PERMISSIONS] : (perms ?? []);
                  const isUserFullAdmin = ALL_PERMISSIONS.every(p => permsArr.includes(p));
                  const isSelf    = currentUserId != null && user.id === currentUserId;
                  const isLocked  = isSelf || user.isFounder;
                  return (
                    <div key={user.id ?? `founder-${idx}`} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isSelf ? "bg-primary/5 border-l-2 border-primary" : user.isFounder ? "bg-secondary/30" : "hover:bg-secondary/20"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                          {isSelf && (
                            <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">Yönetici (Siz)</span>
                          )}
                          {!isSelf && user.isAdmin === 1 && (
                            isUserFullAdmin
                              ? <span className="text-[10px] bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded-full shrink-0">admin</span>
                              : <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">moderatör</span>
                          )}
                          {user.emailVerified === 0 && (
                            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">doğrulanmadı</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "—"}
                          {user.credits !== null ? ` · ${user.credits} kredi` : ""}
                          {user.isAdmin === 1 && permsArr.length > 0 && !isUserFullAdmin && (
                            <span className="ml-1 text-muted-foreground/60">
                              · {permsArr.map(p => PERM_LABELS[p] || p).join(", ")}
                            </span>
                          )}
                        </p>
                      </div>
                      {isLocked ? (
                        <span className="text-[11px] font-bold text-red-500 tracking-wide shrink-0">YÖNETİCİ</span>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          {canCreditOp && (
                            <button
                              onClick={() => { setCreditModal({ userId: user.id!, email: user.email }); setCreditAmount(""); setCreditDesc(""); setCreditSent(false); }}
                              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Kredi Güncelle"
                            >
                              <Coins size={13} />
                            </button>
                          )}
                          {isCurrentFullAdmin && (
                            <button
                              onClick={() => openPermModal(user as User & { id: number })}
                              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Yetki Yönet"
                            >
                              <Shield size={13} />
                            </button>
                          )}
                          {canUserOp && (
                            <button
                              onClick={() => { setDeleteModal({ userId: user.id!, email: user.email }); setDeleteStep("confirm"); setDeleteOtp(""); setDeleteError(""); }}
                              className="p-2 border border-destructive/30 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Kullanıcıyı Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Kredi modal ──────────────────────────────────────────────────────────── */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4">
            {creditSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail size={20} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Onay Maili Gönderildi</h3>
                <p className="text-xs text-muted-foreground">
                  E-posta adresinize gelen onay linkine tıkladığınızda kredi transferi gerçekleşecek.
                </p>
                <button onClick={closeCreditModal} className="w-full py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                  Kapat
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Kredi Güncelle</h3>
                  <button onClick={closeCreditModal} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                </div>
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
                  <button onClick={closeCreditModal} className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                    İptal
                  </button>
                  <button
                    onClick={handleCredit}
                    disabled={saving || !creditAmount || creditAmount === "-"}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {saving ? "Gönderiliyor..." : "Onayla ve Gönder"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Silme modal ──────────────────────────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Kullanıcıyı Sil</h3>
              <button onClick={closeDeleteModal} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>

            {deleteStep === "confirm" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{deleteModal.email}</span> adlı kullanıcıyı silmek istediğinize emin misiniz?
                </p>
                <p className="text-xs text-muted-foreground/70">Onaylamak için admin e-posta adresinize bir doğrulama kodu gönderilecek.</p>
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeDeleteModal} className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                    İptal
                  </button>
                  <button
                    onClick={handleDeleteRequest}
                    disabled={deleteLoading}
                    className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {deleteLoading ? "Gönderiliyor..." : "Kodu Gönder"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Admin e-posta adresinize gönderilen 6 haneli kodu girin. Kod 10 dakika geçerlidir.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={e => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleDeleteConfirm()}
                  placeholder="000000"
                  className="w-full px-3.5 py-3 bg-input border border-border rounded-lg text-lg font-mono text-center outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground tracking-widest"
                  autoFocus
                />
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeDeleteModal} className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                    İptal
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteLoading || deleteOtp.length !== 6}
                    className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {deleteLoading ? "Siliniyor..." : "Onayla ve Sil"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Yetki modal ──────────────────────────────────────────────────────────── */}
      {permModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Yetki Yönetimi</h3>
              <button onClick={() => setPermModal(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <p className="text-xs text-muted-foreground truncate">{permModal.email}</p>

            {permLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Yükleniyor...</div>
            ) : (
              <>
                {/* Admin toggle */}
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Yönetici</p>
                    <p className="text-xs text-muted-foreground">Admin paneline erişim sağlar</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !permIsAdmin;
                      setPermIsAdmin(next);
                      if (next && (!permSelected || permSelected.length === 0)) {
                        setPermSelected([...ALL_PERMISSIONS]);
                      }
                    }}
                    className={`w-10 h-5 rounded-full transition-colors relative ${permIsAdmin ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${permIsAdmin ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                {/* Yetki listesi */}
                {permIsAdmin && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground pb-0.5">Yetkiler</p>
                    {ALL_PERMISSIONS.map(perm => {
                      const isDisabled = DISABLED_PERMISSIONS.has(perm);
                      const isSelected = (permSelected ?? []).includes(perm);
                      return (
                        <button
                          key={perm}
                          onClick={() => !isDisabled && handleTogglePerm(perm)}
                          disabled={isDisabled}
                          title={isDisabled ? "Yakında aktif olacak" : undefined}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                            isDisabled
                              ? "border-border text-muted-foreground/30 cursor-not-allowed opacity-40"
                              : isSelected
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <span>{PERM_LABELS[perm]}</span>
                          {isSelected && !isDisabled && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setPermModal(null)} className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">
                    İptal
                  </button>
                  <button
                    onClick={handleSavePerms}
                    disabled={permSaving}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {permSaving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
