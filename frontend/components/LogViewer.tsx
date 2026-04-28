"use client";
import { useState, useEffect } from "react";
import { BarChart2, CheckCircle2, XCircle, TrendingUp, CalendarDays, Loader2 } from "lucide-react";
import { logAPI } from "@/services/api";

interface Log  { id: number; recipientEmail: string; status: string; sentAt: string; errorMessage?: string; }
interface Stats { total: number; successful: number; failed: number; successRate: number; }

export default function LogViewer() {
  const [days, setDays]     = useState<string[]>([]);
  const [day, setDay]       = useState("");
  const [logs, setLogs]     = useState<Log[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logAPI.getDays().then(r => {
      setDays(r.data);
      if (r.data.length > 0) { setDay(r.data[0]); loadLogs(r.data[0]); }
    }).catch(() => {});
  }, []);

  const loadLogs = async (d: string) => {
    if (!d) return;
    setLoading(true);
    try {
      const r = await logAPI.getByDay(d);
      setLogs(r.data.logs || []);
      setStats(r.data.stats || null);
    } catch {}
    setLoading(false);
  };

  const handleDayChange = (d: string) => { setDay(d); loadLogs(d); };

  const fmt = (s: string) => {
    try { return new Date(s).toLocaleString("tr-TR"); } catch { return s; }
  };
  const fmtDay = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch { return s; }
  };

  return (
    <div className="space-y-6">
      {/* Day selector */}
      <div className="bg-card border border-border rounded-xl p-7">
        <div className="flex items-center gap-2.5 mb-5">
          <CalendarDays size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">Gün Seç</h3>
        </div>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz log kaydı yok</p>
        ) : (
          <select value={day} onChange={e => handleDayChange(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            {days.map(d => <option key={d} value={d}>{fmtDay(d)} ({d})</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <BarChart2 size={22} />, value: stats.total, label: "Toplam", color: "text-foreground" },
            { icon: <CheckCircle2 size={22} />, value: stats.successful, label: "Başarılı", color: "text-primary" },
            { icon: <XCircle size={22} />, value: stats.failed, label: "Başarısız", color: "text-destructive" },
            { icon: <TrendingUp size={22} />, value: `%${stats.successRate}`, label: "Başarı Oranı", color: "text-primary" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6">
              <div className={`mb-3 ${s.color}`}>{s.icon}</div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Logs table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        day && <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <BarChart2 size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">Bu gün için log kaydı yok</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  {["Alıcı Email","Durum","Gönderim Zamanı","Hata"].map((h) => (
                    <th key={h} className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-border/40 last:border-0 ${i % 2 === 1 ? "bg-secondary/30" : ""}`}>
                    <td className="px-5 py-4 text-foreground font-mono text-xs">{log.recipientEmail}</td>
                    <td className="px-5 py-4">
                      {(log.status === "sent" || log.status === "success") ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium"><CheckCircle2 size={12} />Başarılı</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded-full text-xs font-medium"><XCircle size={12} />Başarısız</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs whitespace-nowrap">{fmt(log.sentAt)}</td>
                    <td className="px-5 py-4 text-destructive text-xs max-w-xs truncate">{log.errorMessage || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
