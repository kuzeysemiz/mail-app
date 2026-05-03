"use client";
import { useState, useEffect } from "react";
import { Monitor, Trash2, Loader2, ShieldCheck, Clock, Wifi } from "lucide-react";
import { authAPI } from "@/services/api";

interface Session {
  id: number;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
}

export default function DeviceManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState({ text: "", type: "" });
  const currentDeviceId = typeof window !== "undefined" ? localStorage.getItem("deviceId") : null;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await authAPI.getSessions();
      setSessions(r.data);
    } catch {}
    setLoading(false);
  };

  const showMessage = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  };

  const handleRemove = async (session: Session) => {
    const isCurrent = session.deviceId === currentDeviceId;
    const confirm_msg = isCurrent
      ? "Bu cihazı (mevcut cihazınız) çıkaracaksınız. Çıkış yapılacak, devam etmek istiyor musunuz?"
      : `"${session.deviceName}" cihazının erişimini kaldırmak istiyor musunuz?`;
    if (!confirm(confirm_msg)) return;

    try {
      await authAPI.deleteSession(session.id);
      showMessage("Cihaz bağlantısı kesildi", "success");
      if (isCurrent) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authExpiry");
        window.location.reload();
      } else {
        load();
      }
    } catch {
      showMessage("İşlem başarısız", "error");
    }
  };

  const fmt = (s: string) => {
    try { return new Date(s).toLocaleString("tr-TR"); } catch { return s; }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.72 0.19 155 / 0.15)", color: "oklch(0.72 0.19 155)" }}>
          <Wifi size={24} />
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">{sessions.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Bağlı Cihaz</p>
        </div>
      </div>

      {msg.text && (
        <div className={`px-5 py-4 rounded-xl text-sm border ${msg.type === "success" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-7">
        <div className="flex items-center gap-2.5 mb-2">
          <Monitor size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Bağlı Cihazlar</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-7">
          Sisteme giriş yapmış cihazların listesi. Kaldırılan cihazlar yeni kod almadan giriş yapamaz.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Monitor size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Bağlı cihaz bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const isCurrent = session.deviceId === currentDeviceId;
              const expired   = isExpired(session.expiresAt);
              return (
                <div key={session.id} className={`flex items-center justify-between p-5 rounded-xl border ${isCurrent ? "bg-primary/5 border-primary/40" : "bg-secondary border-border/50"}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isCurrent ? "bg-primary/20 border-primary/30" : "bg-secondary border-border"}`} style={{ border: "1px solid" }}>
                      <Monitor size={18} className={isCurrent ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>{session.deviceName || "Bilinmeyen Cihaz"}</p>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-semibold shrink-0">
                            <ShieldCheck size={10} />Bu cihaz
                          </span>
                        )}
                        {expired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-full text-xs font-medium shrink-0">
                            Süresi doldu
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {expired ? "Sona erdi:" : "Sona erer:"} {fmt(session.expiresAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Giriş: {fmt(session.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(session)}
                    className="p-2 ml-3 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-secondary border border-border rounded-xl p-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Güvenlik notu:</strong> Her oturum 1 saat sonra otomatik olarak sona erer.
          Süresi dolan cihazların yeniden giriş yapması gerekir. Tanımadığınız cihazları hemen kaldırın.
        </p>
      </div>
    </div>
  );
}
