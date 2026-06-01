"use client";
import { useState } from "react";
import { Search, Building2, MapPin, Phone, Globe, Mail, Copy, Check, AlertCircle, Star } from "lucide-react";
import { leadsSearchAPI } from "@/services/api";

type Business = {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  emails: string[];
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Kopyala">
      {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
    </button>
  );
}

export default function LeadsSearch() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Business[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const r = await leadsSearchAPI.search(query.trim());
      setResults(r.data.results);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Arama başarısız, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">İşletme Veri Toplama</h1>
        <p className="text-sm text-muted-foreground mt-1">Şehir ve kategori girerek işletmelerin iletişim bilgilerini bulun. Arama 30–60 saniye sürebilir.</p>
      </div>

      {/* Arama formu */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder='Örn: "İstanbul restoran", "Ankara diş kliniği"'
            className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
        >
          {loading ? "Aranıyor..." : "Ara"}
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-3 bg-secondary rounded w-full" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Sonuç yok */}
      {!loading && results && results.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Sonuç bulunamadı. Farklı bir arama deneyin.
        </div>
      )}

      {/* Sonuçlar */}
      {!loading && results && results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{results.length} işletme bulundu</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((b, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
                {/* İsim */}
                <div className="flex items-start gap-2">
                  <Building2 size={15} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-sm font-semibold text-foreground leading-snug">{b.name || "—"}</p>
                </div>

                {/* Rating */}
                {b.rating && (
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-muted-foreground">{b.rating.toFixed(1)}</span>
                    {b.reviewCount > 0 && <span className="text-xs text-muted-foreground/60">({b.reviewCount})</span>}
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  {/* Adres */}
                  {b.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin size={12} className="mt-0.5 shrink-0" />
                      <span className="leading-snug">{b.address}</span>
                    </div>
                  )}

                  {/* Telefon */}
                  {b.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={12} className="shrink-0" />
                      <span>{b.phone}</span>
                      <CopyButton text={b.phone} />
                    </div>
                  )}

                  {/* Website */}
                  {b.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe size={12} className="shrink-0" />
                      <a
                        href={b.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate max-w-[180px]"
                      >
                        {b.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {/* Email'ler */}
                  {b.emails.length > 0 ? (
                    <div className="pt-1 space-y-1">
                      {b.emails.map((email, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <Mail size={12} className="text-primary shrink-0" />
                          <span className="text-foreground font-medium truncate">{email}</span>
                          <CopyButton text={email} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1 text-muted-foreground/50">
                      <Mail size={12} className="shrink-0" />
                      <span>Email bulunamadı</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
