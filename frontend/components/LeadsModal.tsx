"use client";
import { useState, useEffect, useRef } from "react";
import { X, Search, Building2, ChevronRight, Users, Download, Check, Loader2, AlertCircle, Trash2, Key, Sparkles } from "lucide-react";
import { leadsAPI, emailAPI } from "@/services/api";

interface Lead {
  id: number;
  company: string;
  domain: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  confidence: number;
}

interface Company {
  company: string;
  domain: string;
  count: number;
  tags: string[];
}

interface Tag {
  tag: string;
  count: number;
}

interface Props {
  onClose: () => void;
  onSelect: (emails: string[]) => void;
}

// Tag'e göre deterministik renk
const TAG_COLORS = [
  { bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30"   },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  { bg: "bg-emerald-500/15",text: "text-emerald-400",border: "border-emerald-500/30"},
  { bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30"  },
  { bg: "bg-rose-500/15",   text: "text-rose-400",   border: "border-rose-500/30"   },
  { bg: "bg-cyan-500/15",   text: "text-cyan-400",   border: "border-cyan-500/30"   },
  { bg: "bg-pink-500/15",   text: "text-pink-400",   border: "border-pink-500/30"   },
  { bg: "bg-lime-500/15",   text: "text-lime-400",   border: "border-lime-500/30"   },
  { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  { bg: "bg-teal-500/15",   text: "text-teal-400",   border: "border-teal-500/30"   },
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

function TagBadge({ tag, small = false }: { tag: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center border rounded-full font-medium bg-secondary text-muted-foreground border-border/60 ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}>
      {tag}
    </span>
  );
}

export default function LeadsModal({ onClose, onSelect }: Props) {
  const [companies, setCompanies]             = useState<Company[]>([]);
  const [leads, setLeads]                     = useState<Lead[]>([]);
  const [titles, setTitles]                   = useState<string[]>([]);
  const [tags, setTags]                       = useState<Tag[]>([]);
  const [activeTag, setActiveTag]             = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle]     = useState<string>("");
  const [companySearch, setCompanySearch]     = useState("");
  const [leadSearch, setLeadSearch]           = useState("");
  const [allSelected, setAllSelected]         = useState<Map<number, Lead>>(new Map());
  const [leadStatus, setLeadStatus]           = useState<Record<string, { sendCount: number; lastSent: string }>>({});
  const [loading, setLoading]                 = useState(false);
  const [tagging, setTagging]                 = useState(false);
  const [tagMsg, setTagMsg]                   = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [importing, setImporting]             = useState(false);
  const [importMsg, setImportMsg]             = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [filling, setFilling]                 = useState(false);
  const [fillMsg, setFillMsg]                 = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showImport, setShowImport]           = useState(false);
  const [apiKeyInput, setApiKeyInput]         = useState("");
  const [savedKey, setSavedKey]               = useState<{ saved: boolean; masked?: string }>({ saved: false });
  const [savingKey, setSavingKey]             = useState(false);
  const [stats, setStats]                     = useState<{ total: number; companies: number } | null>(null);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCompanies();
    leadsAPI.getStats().then(r => setStats(r.data)).catch(() => {});
    leadsAPI.getApiKey().then(r => setSavedKey(r.data)).catch(() => {});
    leadsAPI.getTags().then(r => setTags(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCompanies(companySearch, activeTag, true), 300);
  }, [companySearch, activeTag]);

  useEffect(() => {
    if (!selectedCompany) return;
    leadsAPI.getTitles(selectedCompany).then(r => setTitles(r.data)).catch(() => {});
    setSelectedTitle("");
    loadLeads(selectedCompany, "");
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadLeads(selectedCompany, selectedTitle, leadSearch), 300);
  }, [selectedTitle, leadSearch]);

  const loadCompanies = async (q?: string, tag?: string, autoSelectFirst = false) => {
    try {
      const r = await leadsAPI.getCompanies({ q: q || undefined, tag: tag || undefined });
      setCompanies(r.data);
      if (autoSelectFirst && r.data.length > 0) {
        setSelectedCompany(r.data[0].company);
      }
    } catch {}
  };

  const loadLeads = async (company: string, title: string, q?: string) => {
    setLoading(true);
    try {
      const r = await leadsAPI.getLeads({ company, title: title || undefined, q: q || undefined });
      setLeads(r.data);
      const emails = r.data.map((l: Lead) => l.email);
      if (emails.length > 0) {
        emailAPI.checkRecipients(emails).then(cr => setLeadStatus(cr.data)).catch(() => {});
      } else {
        setLeadStatus({});
      }
    } catch {}
    setLoading(false);
  };

  const refreshTags = async () => {
    const r = await leadsAPI.getTags().catch(() => null);
    if (r) setTags(r.data);
  };

  const handleAutoTag = async () => {
    setTagging(true);
    setTagMsg(null);
    try {
      const r = await leadsAPI.autoTag();
      const msg = r.data.tagged === 0
        ? "Tüm şirketler zaten etiketli"
        : `${r.data.companies} şirketten ${r.data.tagged} etiket atandı`;
      setTagMsg({ text: msg, type: "success" });
      await refreshTags();
      loadCompanies(companySearch, activeTag);
    } catch (err: any) {
      setTagMsg({ text: err.response?.data?.error || "Etiketleme başarısız", type: "error" });
    }
    setTagging(false);
  };

  const handleFillCompanies = async () => {
    setFilling(true);
    setFillMsg(null);
    try {
      const r = await leadsAPI.fillCompanies();
      const msg = r.data.filled === 0
        ? "Tüm lead'lerin şirketi zaten dolu"
        : `${r.data.filled} lead şirkete atandı`;
      setFillMsg({ text: msg, type: "success" });
      leadsAPI.getStats().then(rs => setStats(rs.data)).catch(() => {});
      loadCompanies(companySearch, activeTag);
    } catch (err: any) {
      setFillMsg({ text: err.response?.data?.error || "İşlem başarısız", type: "error" });
    }
    setFilling(false);
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await leadsAPI.saveApiKey(apiKeyInput.trim());
      const r = await leadsAPI.getApiKey();
      setSavedKey(r.data);
      setApiKeyInput("");
    } catch {}
    setSavingKey(false);
  };

  const handleDeleteKey = async () => {
    try {
      await leadsAPI.deleteApiKey();
      setSavedKey({ saved: false });
    } catch {}
  };

  const handleImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await leadsAPI.import();
      const { totalImported, totalDuplicate, totalFetched } = r.data;
      const parts = [`${totalImported} yeni kişi içe aktarıldı`];
      if (totalDuplicate > 0) parts.push(`${totalDuplicate} zaten mevcut`);
      setImportMsg({ text: `${totalFetched} lead çekildi — ${parts.join(", ")}`, type: "success" });
      leadsAPI.getStats().then(r => setStats(r.data)).catch(() => {});
      loadCompanies(companySearch, activeTag);
    } catch (err: any) {
      setImportMsg({ text: err.response?.data?.error || "İçe aktarma başarısız", type: "error" });
    }
    setImporting(false);
  };

  const toggleLead = (lead: Lead) => {
    setAllSelected(prev => {
      const next = new Map(prev);
      next.has(lead.id) ? next.delete(lead.id) : next.set(lead.id, lead);
      return next;
    });
  };

  const toggleAll = () => {
    const allCurrentSelected = leads.every(l => allSelected.has(l.id));
    setAllSelected(prev => {
      const next = new Map(prev);
      if (allCurrentSelected) {
        leads.forEach(l => next.delete(l.id));
      } else {
        leads.forEach(l => next.set(l.id, l));
      }
      return next;
    });
  };

  const removeCompanySelection = (company: string) => {
    setAllSelected(prev => {
      const next = new Map(prev);
      prev.forEach((lead, id) => { if (lead.company === company) next.delete(id); });
      return next;
    });
  };

  const handleSelect = () => {
    onSelect(Array.from(allSelected.values()).map(l => l.email));
    onClose();
  };

  // Seçili şirketleri grupla
  const selectedByCompany = Array.from(allSelected.values()).reduce((acc, lead) => {
    const key = lead.company || "—";
    if (!acc[key]) acc[key] = [];
    acc[key].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Kişi Listesinden Seç</h2>
              {stats && (
                <p className="text-xs text-muted-foreground mt-0.5">{stats.total} kişi · {stats.companies} şirket</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFillCompanies}
              disabled={filling}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-60 transition-colors"
            >
              {filling ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />}
              {filling ? "Analiz ediliyor..." : "Şirketleri Tamamla"}
            </button>
            <button
              onClick={handleAutoTag}
              disabled={tagging}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {tagging ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {tagging ? "Etiketleniyor..." : "AI ile Etiketle"}
            </button>
            <button
              onClick={() => setShowImport(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <Download size={13} />Hunter.io
            </button>
            <button onClick={onClose} className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Fill companies message */}
        {fillMsg && (
          <div className={`px-6 py-4 border-b border-border flex items-center gap-2 text-xs ${fillMsg.type === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {fillMsg.type === "success" ? <Check size={13} /> : <AlertCircle size={13} />}
            {fillMsg.text}
          </div>
        )}

        {/* Tag message */}
        {tagMsg && (
          <div className={`px-6 py-4 border-b border-border flex items-center gap-2 text-xs ${tagMsg.type === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {tagMsg.type === "success" ? <Check size={13} /> : <AlertCircle size={13} />}
            {tagMsg.text}
          </div>
        )}

        {/* Import panel */}
        {showImport && (
          <div className="px-6 py-5 bg-secondary border-b border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              Hunter.io API anahtarınızı{" "}
              <a href="https://hunter.io/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">hunter.io/api-keys</a>
              {" "}adresinden alabilirsiniz.
            </p>
            {savedKey.saved ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-input border border-border rounded-lg">
                  <Key size={13} className="text-primary shrink-0" />
                  <span className="text-sm text-foreground font-mono">{savedKey.masked}</span>
                  <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">Kayıtlı</span>
                </div>
                <button onClick={handleDeleteKey} className="p-2.5 bg-input border border-border rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors" title="Sil">
                  <Trash2 size={14} />
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {importing ? "Aktarılıyor..." : "İçe Aktar"}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                  placeholder="Hunter.io API Anahtarı"
                  className="flex-1 px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                <button onClick={handleSaveKey} disabled={savingKey || !apiKeyInput.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50">
                  {savingKey ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  Kaydet
                </button>
              </div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${importMsg.type === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {importMsg.type === "success" ? <Check size={13} /> : <AlertCircle size={13} />}
                {importMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Company list */}
          <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2.5 px-3.5 py-3 bg-input border border-border rounded-lg focus-within:ring-1 focus-within:ring-ring">
                <Search size={14} className="shrink-0 text-muted-foreground pointer-events-none" />
                <input type="text" value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Şirket ara..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
              </div>
            </div>

            {/* Tag filter chips */}
            {tags.length > 0 && (
              <div className="px-4 py-3 border-b border-border flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveTag("")}
                  className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-colors ${activeTag === "" ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}
                >
                  Tümü
                </button>
                {tags.map(t => {
                  const c = tagColor(t.tag);
                  const isActive = activeTag === t.tag;
                  return (
                    <button
                      key={t.tag}
                      onClick={() => setActiveTag(isActive ? "" : t.tag)}
                      className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all ${isActive ? `${c.bg} ${c.text} ${c.border} ring-1 ring-offset-0` : `bg-secondary text-muted-foreground border-border hover:${c.bg} hover:${c.text}`}`}
                    >
                      {t.tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Company rows */}
            <div className="flex-1 overflow-y-auto">
              {companies.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <Building2 size={28} className="mx-auto mb-2 opacity-20" />
                  {activeTag ? `"${activeTag}" etiketinde şirket yok` : "Henüz şirket yok"}
                </div>
              ) : (
                companies.map(c => (
                  <button
                    key={c.company}
                    onClick={() => setSelectedCompany(c.company)}
                    className={`w-full text-left px-4 py-3 border-b border-border/40 last:border-0 hover:bg-secondary transition-colors ${selectedCompany === c.company ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{c.company}</p>
                        {c.domain && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.domain}</p>}
                        {c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.tags.map(tag => <TagBadge key={tag} tag={tag} small />)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">{c.count}</span>
                        <ChevronRight size={12} className="text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Leads list */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedCompany ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Building2 size={40} className="mx-auto mb-3 opacity-15" />
                  <p className="text-sm">Soldaki listeden bir şirket seçin</p>
                </div>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="p-4 border-b border-border flex gap-2">
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 flex-1 bg-input border border-border rounded-lg focus-within:ring-1 focus-within:ring-ring">
                    <Search size={14} className="shrink-0 text-muted-foreground pointer-events-none" />
                    <input type="text" value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                      placeholder="İsim veya email ara..."
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  </div>
                  <select value={selectedTitle} onChange={e => setSelectedTitle(e.target.value)}
                    className="px-4 py-2.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Tüm Unvanlar</option>
                    {titles.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Table header */}
                <div className="px-5 py-3 border-b border-border flex items-center gap-3 bg-secondary/50">
                  <input type="checkbox"
                    checked={leads.length > 0 && leads.every(l => allSelected.has(l.id))}
                    onChange={toggleAll} className="accent-primary w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {leads.length} kişi
                  </span>
                </div>

                {/* Lead rows */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Kişi bulunamadı</div>
                  ) : (
                    leads.map(lead => (
                      <label key={lead.id}
                        className={`flex items-center gap-3 px-5 py-4 border-b border-border/40 last:border-0 cursor-pointer transition-colors hover:bg-secondary ${allSelected.has(lead.id) ? "bg-primary/5" : ""}`}>
                        <input type="checkbox" checked={allSelected.has(lead.id)} onChange={() => toggleLead(lead)}
                          className="accent-primary w-3.5 h-3.5 shrink-0" />
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-[11px] font-bold">
                          {(lead.firstName?.[0] || lead.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{lead.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {lead.title && (
                            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full max-w-[120px] truncate">
                              {lead.title}
                            </span>
                          )}
                          {leadStatus[lead.email] ? (
                            <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full whitespace-nowrap">
                              ⚠ {leadStatus[lead.email].sendCount}× · {new Date(leadStatus[lead.email].lastSent).toLocaleDateString("tr-TR")}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full whitespace-nowrap">
                              ✓ İlk kez
                            </span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Seçilen şirketler özet paneli */}
        {allSelected.size > 0 && (
          <div className="border-t border-border px-6 py-4 bg-secondary/40">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Seçilenler — {allSelected.size} kişi
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedByCompany).map(([company, compLeads]) => (
                <div key={company} className="flex items-center gap-2 pl-4 pr-2 py-2.5 bg-card border border-border rounded-lg text-xs">
                  <span className="font-medium text-foreground">{company}</span>
                  <span className="text-muted-foreground">({compLeads.length})</span>
                  <button
                    onClick={() => removeCompanySelection(company)}
                    className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {allSelected.size > 0 ? `${allSelected.size} kişi seçildi` : "Kişi seçilmedi"}
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-3 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              İptal
            </button>
            <button onClick={handleSelect} disabled={allSelected.size === 0}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
              <Check size={15} />Seçilenleri Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
