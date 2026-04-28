"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Settings2, Languages, BookOpen, Plus, FileText, Trash2, Edit2, ChevronDown, ChevronUp, Calendar, Clock, Zap, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { mailboxAPI, emailAPI, draftAPI, savedEmailsAPI, aiAPI, settingsAPI } from "@/services/api";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false, loading: () => <div className="h-40 bg-input border border-border rounded-lg animate-pulse" /> });

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    ["blockquote", "code-block"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["link", "image"],
    ["clean"],
  ],
};
const QUILL_FORMATS = ["header","bold","italic","underline","strike","blockquote","code-block","list","bullet","color","background","link","image"];
const LANGS = ["İngilizce","Almanca","Fransızca","İspanyolca","İtalyanca","Portekizce","Rusça","Japonca","Çince","Korece","Arapça","Hintçe","Hollandaca","Polonyaca","İsveççe","Norveççe","Danimarkaca","Fince","Çekçe","Romence","Macarca","Yunanca","İbranice","Endonezce","Malayca","Tayca","Vietnamca","Ukraynaca","Farsça","Türkçe"];

interface Rule  { id: number; text: string; active: boolean; }
interface LangBtn { id: number; lang: string; }
interface Mailbox { id: number; email: string; }
interface Draft { id: number; draftName: string; mailSubject: string; mailContent: string; mailSignature: string; }

export default function EmailAdder() {
  const [mailboxes, setMailboxes]         = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState("");
  const [recipients, setRecipients]       = useState("");
  const [savedEmails, setSavedEmails]     = useState<string[]>([]);
  const [suggestion, setSuggestion]       = useState({ text: "", lineIndex: -1 });
  const [mailSubject, setMailSubject]     = useState("");
  const [mailContent, setMailContent]     = useState("");
  const [mailSignature, setMailSignature] = useState("");
  const [loading, setLoading]             = useState(false);
  const [msg, setMsg]                     = useState({ text: "", type: "" });
  const [previewSchedule, setPreviewSchedule] = useState<{ date: string; time: string }[]>([]);
  const [drafts, setDrafts]               = useState<Draft[]>([]);
  const [showDraftSave, setShowDraftSave] = useState(false);
  const [draftName, setDraftName]         = useState("");
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [scheduleMode, setScheduleMode]   = useState<"auto"|"week"|"manual">("auto");
  const [manualDate, setManualDate]       = useState(() => new Date().toISOString().split("T")[0]);
  const [manualTime, setManualTime]       = useState("09:00");
  const [selectedWeek, setSelectedWeek]   = useState("1");
  const [businessHours, setBusinessHours] = useState(true);
  const [aiLoading, setAiLoading]         = useState(false);
  const [showAdvancedAI, setShowAdvancedAI] = useState(false);
  const [advancedPrompt, setAdvancedPrompt] = useState("");
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [aiRules, setAiRules]             = useState<Rule[]>([]);
  const [newRuleText, setNewRuleText]     = useState("");
  const [langButtons, setLangButtons]     = useState<LangBtn[]>([]);
  const [showDrafts, setShowDrafts]       = useState(false);
  const rulesPanelRef                     = useRef<HTMLDivElement>(null);
  const textareaRef                       = useRef<HTMLTextAreaElement>(null);

  const showMessage = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  };

  useEffect(() => {
    mailboxAPI.getAll().then(r => {
      setMailboxes(r.data);
      if (r.data.length > 0) setSelectedMailbox(String(r.data[0].id));
    }).catch(() => {});
    savedEmailsAPI.getAll().then(r => setSavedEmails(r.data.map((e: any) => e.email))).catch(() => {});
    settingsAPI.get("ai_rules").then(r => { try { setAiRules(JSON.parse(r.data.value)); } catch {} }).catch(() => {});
    settingsAPI.get("lang_buttons").then(r => { try { setLangButtons(JSON.parse(r.data.value)); } catch {} }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMailbox) draftAPI.getByMailbox(selectedMailbox).then(r => setDrafts(r.data)).catch(() => {});
  }, [selectedMailbox]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rulesPanelRef.current && !rulesPanelRef.current.contains(e.target as Node)) setShowRulesPanel(false);
    };
    if (showRulesPanel) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showRulesPanel]);

  const computeSuggestion = useCallback((value: string, cursor: number) => {
    const textBefore = value.substring(0, cursor);
    const lines = textBefore.split("\n");
    const lineIndex = lines.length - 1;
    const current = lines[lineIndex];
    if (!current.trim()) { setSuggestion({ text: "", lineIndex: -1 }); return; }
    const match = savedEmails.filter(e => e.toLowerCase().startsWith(current.toLowerCase()) && e.toLowerCase() !== current.toLowerCase()).sort()[0];
    setSuggestion(match ? { text: match.slice(current.length), lineIndex } : { text: "", lineIndex: -1 });
  }, [savedEmails]);

  const handleRecipientsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRecipients(e.target.value);
    computeSuggestion(e.target.value, e.target.selectionStart);
  };
  const handleRecipientsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && suggestion.text) {
      e.preventDefault();
      const lines = recipients.split("\n");
      lines[suggestion.lineIndex] += suggestion.text;
      setRecipients(lines.join("\n"));
      setSuggestion({ text: "", lineIndex: -1 });
    }
  };

  const saveRules = async (updated: Rule[]) => {
    setAiRules(updated);
    try { await settingsAPI.set("ai_rules", JSON.stringify(updated)); } catch {}
  };
  const saveLangButtons = async (updated: LangBtn[]) => {
    setLangButtons(updated);
    try { await settingsAPI.set("lang_buttons", JSON.stringify(updated)); } catch {}
  };
  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    saveRules([...aiRules, { id: Date.now(), text: newRuleText.trim(), active: true }]);
    setNewRuleText("");
  };
  const handleAddLangButton = (lang: string) => {
    if (!lang) return;
    if (langButtons.some(b => b.lang === lang)) { showMessage(`${lang} zaten eklenmiş`, "error"); return; }
    if (langButtons.length >= 5) { showMessage("Maksimum 5 dil butonu", "error"); return; }
    saveLangButtons([...langButtons, { id: Date.now(), lang }]);
  };

  const getPlainText = (html: string) => html.replace(/<img[^>]*>/gi,"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();

  const handleAIEnhance = async (mode: string) => {
    if (!mailContent || mailContent === "<p><br></p>") { showMessage("Önce mail içeriği yazın", "error"); return; }
    const text = getPlainText(mailContent);
    if ((text.split(/\s+/).filter(Boolean).length < 10 || text.length < 150) && mode !== "translate") {
      showMessage("İçerik çok kısa (min 10 kelime, 150 karakter)", "error"); return;
    }
    if (mode === "advanced" && !advancedPrompt.trim()) { showMessage("Geliştirme talimatı girin", "error"); return; }
    setAiLoading(true);
    try {
      const r = await aiAPI.enhance(mailContent, mode, advancedPrompt);
      setMailContent(r.data.enhanced);
      showMessage("Mail başarıyla geliştirildi!", "success");
      setShowAdvancedAI(false); setAdvancedPrompt("");
    } catch (err: any) { showMessage(err.response?.data?.error || "AI hatası", "error"); }
    setAiLoading(false);
  };
  const handleTranslate = async (lang: string) => {
    if (!mailContent || mailContent === "<p><br></p>") { showMessage("Önce mail içeriği yazın", "error"); return; }
    setAiLoading(true);
    try {
      const r = await aiAPI.enhance(mailContent, "translate", lang);
      setMailContent(r.data.enhanced);
      showMessage(`${lang} diline çevrildi!`, "success");
    } catch (err: any) { showMessage(err.response?.data?.error || "Çeviri hatası", "error"); }
    setAiLoading(false);
  };

  const handleSaveDraft = async () => {
    if (!draftName.trim()) { showMessage("Taslak adı girin", "error"); return; }
    if (!mailContent.trim()) { showMessage("Mail içeriği boş", "error"); return; }
    try {
      if (editingDraftId) {
        await draftAPI.update(editingDraftId, draftName, mailSubject, mailContent, mailSignature);
        showMessage("Taslak güncellendi", "success"); setEditingDraftId(null);
      } else {
        await draftAPI.create(selectedMailbox, draftName, mailSubject, mailContent, mailSignature);
        showMessage("Taslak kaydedildi", "success");
      }
      setDraftName(""); setShowDraftSave(false);
      draftAPI.getByMailbox(selectedMailbox).then(r => setDrafts(r.data)).catch(() => {});
    } catch { showMessage("Taslak kaydedilemedi", "error"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMailbox) { showMessage("Mailbox seçin", "error"); return; }
    const emailList = recipients.split("\n").map(e => e.trim()).filter(Boolean);
    if (emailList.length === 0) { showMessage("En az bir email girin", "error"); return; }
    if (emailList.length > 100) { showMessage("Maksimum 100 email", "error"); return; }
    if (!mailContent.trim() || mailContent === "<p><br></p>") { showMessage("Mail içeriği boş", "error"); return; }
    if (!mailSubject.trim()) { showMessage("Mail başlığı boş", "error"); return; }
    if (scheduleMode === "manual" && (!manualDate || !manualTime)) { showMessage("Tarih ve saat seçin", "error"); return; }
    setLoading(true);
    try {
      const r = await emailAPI.add(
        selectedMailbox, emailList, mailSubject, mailContent, mailSignature,
        scheduleMode === "manual" ? manualDate : null,
        scheduleMode === "manual" ? manualTime : null,
        scheduleMode === "week" ? selectedWeek : null,
        businessHours
      );
      showMessage(`${r.data.addedCount} email eklendi!`, "success");
      setPreviewSchedule(r.data.scheduledTimes || []);
      setRecipients(""); setMailSubject(""); setMailContent(""); setMailSignature("");
    } catch (err: any) { showMessage(err.response?.data?.error || "Hata oluştu", "error"); }
    setLoading(false);
  };

  const recipientCount = recipients.split("\n").filter(e => e.trim()).length;
  const activeRules = aiRules.filter(r => r.active).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {msg.text && (
        <div className={`px-5 py-4 rounded-xl text-sm border ${msg.type === "success" ? "bg-primary/10 text-primary border-primary/20" : msg.type === "error" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-secondary text-foreground border-border"}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mailbox + Recipients */}
        <div className="bg-card border border-border rounded-xl p-7 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Send size={16} className="text-primary" />Gönderim Ayarları</h3>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Gmail Hesabı</label>
            <select value={selectedMailbox} onChange={e => setSelectedMailbox(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">-- Hesap Seçin --</option>
              {mailboxes.map(mb => <option key={mb.id} value={mb.id}>{mb.email}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mail Adresleri (Her satıra bir)</label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={recipients}
                onChange={handleRecipientsChange}
                onKeyDown={handleRecipientsKeyDown}
                placeholder={"example1@gmail.com\nexample2@gmail.com\nexample3@gmail.com"}
                rows={5}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{recipientCount} / 100 {suggestion.text && <span className="text-primary">• Tab ile tamamla</span>}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mail Başlığı</label>
            <input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)}
              placeholder="Mail başlığını yazın..."
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>

        {/* Content + AI */}
        <div className="bg-card border border-border rounded-xl p-7 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText size={16} className="text-primary" />Mail İçeriği</h3>

          <ReactQuill value={mailContent} onChange={setMailContent} modules={QUILL_MODULES} formats={QUILL_FORMATS} theme="snow" placeholder="Mailinizin içeriğini buraya yazın..." />

          {/* AI Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button type="button" onClick={() => handleAIEnhance("basic")} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              <Sparkles size={13} />{aiLoading && !showAdvancedAI ? "Geliştiriliyor..." : "AI ile Geliştir"}
            </button>
            <button type="button" onClick={() => setShowAdvancedAI(v => !v)} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
              <Settings2 size={13} />Gelişmiş AI
            </button>

            {langButtons.map(btn => (
              <div key={btn.id} className="flex items-stretch border border-primary/50 rounded-lg overflow-hidden">
                <button type="button" onClick={() => handleTranslate(btn.lang)} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50">
                  <Languages size={12} />{btn.lang}
                </button>
                <button type="button" onClick={() => saveLangButtons(langButtons.filter(b => b.id !== btn.id))}
                  className="px-2.5 py-2 bg-primary/5 text-muted-foreground border-l border-primary/30 hover:bg-destructive/10 hover:text-destructive transition-colors text-xs">×</button>
              </div>
            ))}

            <select value="" onChange={e => { handleAddLangButton(e.target.value); (e.target as HTMLSelectElement).value = ""; }}
              className="px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
              <option value="">+ Dil Ekle</option>
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <div className="relative" ref={rulesPanelRef}>
              <button type="button" onClick={() => setShowRulesPanel(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                <BookOpen size={13} />Kurallar {aiRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded-full text-[10px] font-bold">{activeRules}/{aiRules.length}</span>}
              </button>
              {showRulesPanel && (
                <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-card border border-border rounded-xl shadow-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">AI Yazım Kuralları</p>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddRule()}
                      placeholder="Yeni kural..." className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    <button type="button" onClick={handleAddRule} className="px-3 py-2 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-xs font-semibold hover:opacity-90">Ekle</button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {aiRules.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Henüz kural yok</p>}
                    {aiRules.map(rule => (
                      <div key={rule.id} className={cn("flex items-center gap-2 p-2.5 rounded-lg border", rule.active ? "border-border bg-secondary" : "border-border/30 bg-transparent opacity-50")}>
                        <input type="checkbox" checked={rule.active} onChange={() => saveRules(aiRules.map(r => r.id === rule.id ? {...r, active: !r.active} : r))} className="accent-primary" />
                        <span className="flex-1 text-xs text-foreground">{rule.text}</span>
                        <button type="button" onClick={() => saveRules(aiRules.filter(r => r.id !== rule.id))} className="text-muted-foreground hover:text-destructive text-sm">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {showAdvancedAI && (
            <div className="p-5 bg-secondary border border-border rounded-xl space-y-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nasıl geliştirmek istiyorsunuz?</label>
              <textarea value={advancedPrompt} onChange={e => setAdvancedPrompt(e.target.value)} rows={3}
                placeholder="Örn: İngilizce'ye çevir ve daha resmi bir dil kullan..."
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              <button type="button" onClick={() => handleAIEnhance("advanced")} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                <Sparkles size={12} />{aiLoading ? "Geliştiriliyor..." : "Uygula"}
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">İmza (Opsiyonel)</label>
            <ReactQuill value={mailSignature} onChange={setMailSignature} modules={QUILL_MODULES} formats={QUILL_FORMATS} theme="snow" placeholder="Mail imzanızı buraya yazın..." />
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-card border border-border rounded-xl p-7 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Calendar size={16} className="text-primary" />Zamanlama</h3>

          <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
            {(["auto","week","manual"] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setScheduleMode(mode)}
                className={cn("px-5 py-2 rounded-md text-xs font-medium transition-colors", scheduleMode === mode ? "bg-primary text-[oklch(0.11_0.005_260)]" : "text-muted-foreground hover:text-foreground")}>
                {mode === "auto" ? "Otomatik" : mode === "week" ? "Ayın Haftası" : "Manuel"}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <input type="checkbox" checked={businessHours} onChange={e => setBusinessHours(e.target.checked)} className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-foreground">Mesai saatleri (Pzt–Cum, 09:00–17:59)</span>
          </label>

          {scheduleMode === "week" && (
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground">Hafta:</label>
              <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                className="px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="1">1. Hafta (1–7)</option>
                <option value="2">2. Hafta (8–14)</option>
                <option value="3">3. Hafta (15–21)</option>
                <option value="4">4. Hafta (22–28)</option>
              </select>
            </div>
          )}
          {scheduleMode === "manual" && (
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Tarih:</label>
                <input type="date" value={manualDate} min={new Date().toISOString().split("T")[0]} onChange={e => setManualDate(e.target.value)}
                  className="px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Saat:</label>
                <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)}
                  className="px-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            <Zap size={16} />{loading ? "Ekleniyor..." : "Mailları Ekle ve Planla"}
          </button>
          <button type="button" onClick={() => setShowDraftSave(v => !v)}
            className="flex items-center gap-2 px-5 py-3 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <FileText size={16} />{showDraftSave ? "İptal" : "Taslağı Kaydet"}
          </button>
          <button type="button" onClick={() => setShowDrafts(v => !v)}
            className="flex items-center gap-2 px-5 py-3 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <BookOpen size={16} />Taslaklar ({drafts.length})
            {showDrafts ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {showDraftSave && (
          <div className="bg-secondary border border-border rounded-xl p-5 space-y-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taslak Adı</label>
            <div className="flex gap-3">
              <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Taslak adını yazın..."
                className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={handleSaveDraft}
                className="px-5 py-3 bg-primary text-[oklch(0.11_0.005_260)] rounded-lg text-sm font-semibold hover:opacity-90">
                {editingDraftId ? "Güncelle" : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Draft list */}
      {showDrafts && drafts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-7">
          <h3 className="text-sm font-semibold mb-5">Kayıtlı Taslaklar</h3>
          <div className="space-y-3">
            {drafts.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 bg-secondary rounded-xl border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.draftName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.mailSubject}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setMailSubject(d.mailSubject); setMailContent(d.mailContent); setMailSignature(d.mailSignature||""); showMessage(`"${d.draftName}" yüklendi`, "success"); }}
                    className="px-3 py-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors text-xs font-medium">Yükle</button>
                  <button onClick={() => { setEditingDraftId(d.id); setDraftName(d.draftName); setMailSubject(d.mailSubject); setMailContent(d.mailContent); setMailSignature(d.mailSignature||""); setShowDraftSave(true); }}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-md transition-colors"><Edit2 size={14} /></button>
                  <button onClick={async () => { if (confirm("Taslağı sil?")) { await draftAPI.delete(d.id); draftAPI.getByMailbox(selectedMailbox).then(r => setDrafts(r.data)).catch(()=>{}); }}}
                    className="p-2 text-muted-foreground hover:text-destructive rounded-md transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule preview */}
      {previewSchedule.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-7">
          <h3 className="text-sm font-semibold mb-5 flex items-center gap-2"><Clock size={16} className="text-primary" />Zamanlama Önizleme</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarih</th>
                <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saat</th>
              </tr></thead>
              <tbody>
                {previewSchedule.slice(0, 10).map((s, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-3 text-muted-foreground">{i+1}</td>
                    <td className="py-3 text-foreground">{s.date}</td>
                    <td className="py-3 text-foreground">{s.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewSchedule.length > 10 && <p className="text-xs text-muted-foreground mt-3">+{previewSchedule.length-10} daha...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
