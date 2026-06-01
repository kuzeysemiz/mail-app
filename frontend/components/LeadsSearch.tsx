"use client";
import { useState, useMemo } from "react";
import { Search, Building2, MapPin, Phone, Globe, Mail, Copy, Check, AlertCircle, Star, ChevronDown } from "lucide-react";
import { leadsSearchAPI } from "@/services/api";
import { TURKEY_LOCATIONS, CITY_NAMES } from "@/data/turkeyLocations";
import { LEAD_CATEGORIES } from "@/data/leadsCategories";

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
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="Kopyala"
    >
      {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
    </button>
  );
}

export default function LeadsSearch() {
  const [city, setCity]               = useState("");
  const [districts, setDistricts]     = useState<string[]>([]);
  const [categories, setCategories]   = useState<string[]>([]);
  const [hotelStars, setHotelStars]   = useState<number>(0);
  const [results, setResults]         = useState<Business[] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [districtSearch, setDistrictSearch] = useState("");

  const cityDistricts = useMemo(() => TURKEY_LOCATIONS[city] || [], [city]);
  const filteredDistricts = useMemo(
    () => cityDistricts.filter(d => d.toLowerCase().includes(districtSearch.toLowerCase())),
    [cityDistricts, districtSearch]
  );
  const showHotelOptions = categories.includes("otel");
  const selectedCategories = LEAD_CATEGORIES.filter(c => categories.includes(c.id));

  const toggleDistrict = (d: string) =>
    setDistricts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const toggleCategory = (id: string) =>
    setCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAllDistricts = () => setDistricts([...cityDistricts]);
  const clearDistricts = () => setDistricts([]);

  const handleCityChange = (c: string) => {
    setCity(c);
    setDistricts([]);
    setDistrictSearch("");
  };

  const canSearch = city && districts.length > 0 && categories.length > 0;

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const r = await leadsSearchAPI.search({
        city,
        districts,
        categories: selectedCategories.map(c => ({ id: c.id, query: c.query })),
        options: hotelStars > 0 ? { hotelStars } : {},
      });
      setResults(r.data.results);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Arama başarısız, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Lead Bul</h1>
        <p className="text-sm text-muted-foreground mt-1">İşletme iletişim bilgilerini Google Maps'ten toplayın. Arama 30–90 saniye sürebilir.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* İl Seçimi */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1. Şehir</p>
          <div className="relative">
            <select
              value={city}
              onChange={e => handleCityChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring appearance-none pr-8"
            >
              <option value="">Şehir seçin...</option>
              {CITY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* İlçe Seçimi */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">2. İlçe</p>
            {city && (
              <div className="flex gap-2">
                <button onClick={selectAllDistricts} className="text-[10px] text-primary hover:underline">Tümü</button>
                <button onClick={clearDistricts} className="text-[10px] text-muted-foreground hover:underline">Temizle</button>
              </div>
            )}
          </div>
          {!city ? (
            <p className="text-xs text-muted-foreground/50 py-4 text-center">Önce şehir seçin</p>
          ) : (
            <>
              <input
                value={districtSearch}
                onChange={e => setDistrictSearch(e.target.value)}
                placeholder="İlçe ara..."
                className="w-full px-3 py-1.5 bg-input border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {filteredDistricts.map(d => (
                  <label key={d} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={districts.includes(d)}
                      onChange={() => toggleDistrict(d)}
                      className="accent-primary w-3.5 h-3.5 shrink-0"
                    />
                    <span className="text-xs text-foreground">{d}</span>
                  </label>
                ))}
              </div>
              {districts.length > 0 && (
                <p className="text-[10px] text-primary">{districts.length} ilçe seçildi</p>
              )}
            </>
          )}
        </div>

        {/* Kategori Seçimi */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3. Kategori</p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {LEAD_CATEGORIES.map(cat => (
              <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={categories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="accent-primary w-3.5 h-3.5 shrink-0"
                />
                <span className="text-xs text-foreground">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Sektör Filtreleri */}
      {showHotelOptions && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Otel — Minimum Yıldız</p>
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setHotelStars(s)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  hotelStars === s
                    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s === 0 ? "Fark etmez" : (
                  <>
                    {s}
                    <Star size={10} className="fill-current" />
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Özet + Arama */}
      <div className="flex items-center gap-4">
        <div className="flex-1 text-xs text-muted-foreground">
          {canSearch && (
            <span>
              <span className="text-foreground font-medium">{districts.length} ilçe</span>
              {" × "}
              <span className="text-foreground font-medium">{categories.length} kategori</span>
              {" = "}
              <span className="text-primary font-medium">{districts.length * categories.length} arama</span>
            </span>
          )}
        </div>
        <button
          onClick={search}
          disabled={loading || !canSearch}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
        >
          <Search size={14} />
          {loading ? "Aranıyor..." : "Aramayı Başlat"}
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
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
            Google Maps taranıyor, lütfen bekleyin...
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sonuç yok */}
      {!loading && results && results.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Sonuç bulunamadı. Farklı ilçe veya kategori deneyin.
        </div>
      )}

      {/* Sonuçlar */}
      {!loading && results && results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{results.length} işletme bulundu</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((b, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-2">
                  <Building2 size={15} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-sm font-semibold text-foreground leading-snug">{b.name || "—"}</p>
                </div>

                {b.rating && (
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-muted-foreground">{b.rating.toFixed(1)}</span>
                    {b.reviewCount > 0 && <span className="text-xs text-muted-foreground/60">({b.reviewCount})</span>}
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  {b.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin size={12} className="mt-0.5 shrink-0" />
                      <span className="leading-snug">{b.address}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={12} className="shrink-0" />
                      <span>{b.phone}</span>
                      <CopyButton text={b.phone} />
                    </div>
                  )}
                  {b.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe size={12} className="shrink-0" />
                      <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[180px]">
                        {b.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
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
                    <div className="flex items-center gap-2 pt-1 text-muted-foreground/40">
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
