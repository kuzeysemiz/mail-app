"use client";
import { useState, useEffect, useCallback } from "react";
import { Coins, RefreshCw, ArrowUpRight, ArrowDownRight, Zap, Building2 } from "lucide-react";
import { creditsAPI, paddleAPI, userAPI } from "@/services/api";

type Transaction = {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

type Package = {
  id: number;
  name: string;
  slug: string;
  emailCount: number | null;
  price: number | null;
  pricePerEmail: number | null;
  paddlePriceId: string | null;
  isActive: number;
};

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: object) => void };
    };
  }
}

let paddleInitialized = false;

async function initPaddle() {
  if (paddleInitialized || !window.Paddle) return false;
  try {
    const { data } = await paddleAPI.getConfig();
    if (!data.clientToken) return false;
    if (data.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: data.clientToken });
    paddleInitialized = true;
    return true;
  } catch { return false; }
}

interface Props {
  onCreditsChange?: (credits: number) => void;
}

export default function CreditsPanel({ onCreditsChange }: Props) {
  const [balance, setBalance]       = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [packages, setPackages]     = useState<Package[]>([]);
  const [userId, setUserId]         = useState<number | null>(null);
  const [userEmail, setUserEmail]   = useState("");
  const [loading, setLoading]       = useState(true);
  const [buying, setBuying]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, txRes, pkgRes, meRes] = await Promise.all([
        creditsAPI.getBalance(),
        creditsAPI.getTransactions(),
        creditsAPI.getPackages(),
        userAPI.me(),
      ]);
      setBalance(balRes.data.balance);
      setTransactions(txRes.data);
      setPackages(pkgRes.data);
      setUserId(meRes.data.user?.id || null);
      setUserEmail(meRes.data.user?.email || "");
      if (typeof balRes.data.balance === 'number') onCreditsChange?.(balRes.data.balance);
    } catch { /* sessiz */ }
    finally { setLoading(false); }
  }, [onCreditsChange]);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (pkg: Package) => {
    if (!pkg.paddlePriceId || !userId) return;
    setBuying(pkg.slug);
    try {
      const ready = await initPaddle();
      if (!ready || !window.Paddle) {
        alert('Ödeme sistemi hazır değil. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: pkg.paddlePriceId, quantity: 1 }],
        customData: { userId },
        customer: { email: userEmail },
      });
    } finally {
      setBuying(null);
    }
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Bakiye */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
          <Coins size={28} className="text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Mevcut Kredi Bakiyesi</p>
          <p className="text-4xl font-bold text-foreground mt-0.5">
            {loading ? "—" : balance?.toLocaleString("tr-TR") ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Her kredi 1 mail gönderimi = 1 kredi</p>
        </div>
        <button onClick={load} className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Paketler */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Kredi Satın Al</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {packages.map(pkg => (
            <div key={pkg.slug} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {pkg.slug === 'enterprise' ? <Building2 size={15} className="text-primary" /> : <Zap size={15} className="text-primary" />}
                <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
              </div>

              {pkg.emailCount ? (
                <div>
                  <p className="text-2xl font-bold text-foreground">{pkg.emailCount.toLocaleString("tr-TR")}</p>
                  <p className="text-xs text-muted-foreground">kredi</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Özel teklif</p>
              )}

              {pkg.price !== null && pkg.price > 0 && (
                <p className="text-sm text-foreground font-medium">{pkg.price.toLocaleString("tr-TR")} ₺</p>
              )}
              {pkg.pricePerEmail && (
                <p className="text-xs text-muted-foreground">{(pkg.pricePerEmail * 100).toFixed(0)} kr/kredi</p>
              )}

              {pkg.slug === 'free' ? (
                <span className="text-xs text-muted-foreground text-center py-1.5">Kayıtta verilir</span>
              ) : pkg.slug === 'enterprise' ? (
                <a
                  href="mailto:info@mailsender.app"
                  className="text-center py-2 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  Bize Ulaşın
                </a>
              ) : pkg.paddlePriceId ? (
                <button
                  onClick={() => handleBuy(pkg)}
                  disabled={buying === pkg.slug}
                  className="py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {buying === pkg.slug ? "Açılıyor..." : "Satın Al"}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground text-center py-1.5">Yakında</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* İşlem Geçmişi */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">İşlem Geçmişi</h2>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Yükleniyor...</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Henüz işlem yok</div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tx.amount > 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {tx.amount > 0
                    ? <ArrowUpRight size={13} className="text-primary" />
                    : <ArrowDownRight size={13} className="text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(tx.createdAt)}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
