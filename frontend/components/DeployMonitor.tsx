"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  GitBranch, GitCommit, RefreshCw, CheckCircle2, XCircle,
  Clock, Loader2, ChevronDown, ChevronRight, Settings, Trash2, Eye, EyeOff,
} from "lucide-react";
import { deployAPI } from "@/services/api";

type StepStatus = "queued" | "in_progress" | "completed";
type Conclusion = "success" | "failure" | "cancelled" | "skipped" | "timed_out" | null;

interface Step {
  name: string;
  status: StepStatus;
  conclusion: Conclusion;
  started_at: string | null;
  completed_at: string | null;
  number: number;
}

interface Job {
  id: number;
  name: string;
  status: StepStatus;
  conclusion: Conclusion;
  started_at: string | null;
  completed_at: string | null;
  steps: Step[];
}

interface Run {
  id: number;
  name: string;
  status: StepStatus | "waiting";
  conclusion: Conclusion;
  head_branch: string;
  head_sha: string;
  head_commit: { message: string; author: { name: string } };
  actor: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  run_number: number;
  html_url: string;
  workflow_id: number;
}

function statusColor(status: string, conclusion: Conclusion) {
  if (status === "in_progress") return "text-blue-500";
  if (status === "queued" || status === "waiting") return "text-yellow-500";
  if (conclusion === "success") return "text-primary";
  if (conclusion === "failure" || conclusion === "timed_out") return "text-destructive";
  return "text-muted-foreground";
}

function StatusIcon({ status, conclusion, size = 15 }: { status: string; conclusion: Conclusion; size?: number }) {
  if (status === "in_progress") return <Loader2 size={size} className="text-blue-500 animate-spin" />;
  if (status === "queued" || status === "waiting") return <Clock size={size} className="text-yellow-500" />;
  if (conclusion === "success") return <CheckCircle2 size={size} className="text-primary" />;
  if (conclusion === "failure" || conclusion === "timed_out") return <XCircle size={size} className="text-destructive" />;
  return <Clock size={size} className="text-muted-foreground" />;
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: Conclusion }) {
  let bg = "bg-secondary text-muted-foreground";
  let label = conclusion || status;
  if (status === "in_progress") { bg = "bg-blue-500/10 text-blue-500"; label = "Devam ediyor"; }
  else if (status === "queued" || status === "waiting") { bg = "bg-yellow-500/10 text-yellow-600"; label = "Bekliyor"; }
  else if (conclusion === "success") { bg = "bg-primary/10 text-primary"; label = "Başarılı"; }
  else if (conclusion === "failure") { bg = "bg-destructive/10 text-destructive"; label = "Başarısız"; }
  else if (conclusion === "cancelled") { bg = "bg-secondary text-muted-foreground"; label = "İptal edildi"; }
  else if (conclusion === "timed_out") { bg = "bg-destructive/10 text-destructive"; label = "Zaman aşımı"; }

  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bg}`}>{label}</span>;
}

function duration(start: string | null, end: string | null) {
  if (!start) return null;
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function JobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState(job.status === "in_progress");

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
      >
        <StatusIcon status={job.status} conclusion={job.conclusion} size={14} />
        <span className={`flex-1 text-sm font-medium ${statusColor(job.status, job.conclusion)}`}>{job.name}</span>
        {duration(job.started_at, job.completed_at) && (
          <span className="text-xs text-muted-foreground">{duration(job.started_at, job.completed_at)}</span>
        )}
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
      </button>

      {open && job.steps?.length > 0 && (
        <div className="border-t border-border divide-y divide-border/50">
          {job.steps.map(step => (
            <div key={step.number} className="flex items-center gap-3 px-5 py-2.5 bg-secondary/20">
              <StatusIcon status={step.status} conclusion={step.conclusion} size={12} />
              <span className={`flex-1 text-xs ${step.conclusion === "skipped" ? "text-muted-foreground line-through" : statusColor(step.status, step.conclusion)}`}>
                {step.name}
              </span>
              {duration(step.started_at, step.completed_at) && (
                <span className="text-[11px] text-muted-foreground">{duration(step.started_at, step.completed_at)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunDetail({ run, onClose }: { run: Run; onClose: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    deployAPI.getJobs(run.id)
      .then(r => setJobs(r.data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [run.id]);

  useEffect(() => {
    load();
    if (run.status === "in_progress" || run.status === "queued") {
      const t = setInterval(load, 5000);
      return () => clearInterval(t);
    }
  }, [load, run.status]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <StatusIcon status={run.status} conclusion={run.conclusion} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{run.name} #{run.run_number}</p>
          <p className="text-xs text-muted-foreground truncate">{run.head_commit.message.split('\n')[0]}</p>
        </div>
        <StatusBadge status={run.status} conclusion={run.conclusion} />
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
          ← Geri
        </button>
      </div>

      <div className="p-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Yükleniyor...
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Job bulunamadı</p>
        ) : (
          jobs.map(job => <JobRow key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}

export default function DeployMonitor() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasActiveRun = runs.some(r => r.status === "in_progress" || r.status === "queued");

  const loadRuns = useCallback(() => {
    deployAPI.getRuns()
      .then(r => { setRuns(r.data.workflow_runs || []); setError(""); })
      .catch(e => {
        const msg = e.response?.data?.error || "GitHub API hatası";
        if (msg.includes("Bad credentials") || msg.includes("401")) {
          setError("Geçersiz token — lütfen yeniden girin");
          setToken("");
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    deployAPI.getConfig().then(r => {
      if (r.data.saved) setToken(r.data.masked);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadRuns();
  }, [token, loadRuns]);

  // Aktif run varken 5 sn'de bir, yoksa 30 sn'de bir yenile
  useEffect(() => {
    if (!token) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(loadRuns, hasActiveRun ? 5000 : 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token, hasActiveRun, loadRuns]);

  // Seçili run varken onu da güncelle
  useEffect(() => {
    if (!selectedRun || !hasActiveRun) return;
    const t = setInterval(() => {
      deployAPI.getRun(selectedRun.id).then(r => setSelectedRun(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [selectedRun, hasActiveRun]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      await deployAPI.saveToken(tokenInput.trim());
      setToken("ghp_****" + tokenInput.trim().slice(-4));
      setTokenInput("");
      setShowTokenInput(false);
      setLoading(true);
      loadRuns();
    } catch {
      setError("Token kaydedilemedi");
    } finally {
      setSavingToken(false);
    }
  };

  const handleDeleteToken = async () => {
    await deployAPI.deleteToken().catch(() => {});
    setToken("");
    setRuns([]);
    setError("");
  };

  if (!token || showTokenInput) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <GitBranch size={17} className="text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">GitHub Actions Monitörü</p>
              <p className="text-xs text-muted-foreground">kuzeysemiz/mail-app</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            GitHub Personal Access Token gerekli.{" "}
            <span className="font-medium">Settings → Developer settings → Personal access tokens (Classic)</span>{" "}
            — <code className="bg-secondary px-1 py-0.5 rounded text-[11px]">repo</code> veya{" "}
            <code className="bg-secondary px-1 py-0.5 rounded text-[11px]">actions:read</code> yetkisi yeterli.
          </p>
          <div className="relative flex items-center gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveToken()}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground font-mono"
            />
            <button onClick={() => setShowToken(v => !v)} className="p-2 text-muted-foreground hover:text-foreground">
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveToken}
              disabled={savingToken || !tokenInput.trim()}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingToken ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {token && (
              <button
                onClick={() => setShowTokenInput(false)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground"
              >
                İptal
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedRun) {
    return (
      <div className="space-y-4">
        <RunDetail run={selectedRun} onClose={() => setSelectedRun(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <GitBranch size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">kuzeysemiz/mail-app</span>
          {hasActiveRun && (
            <span className="flex items-center gap-1 text-[11px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Canlı
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); loadRuns(); }}
            disabled={loading}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowTokenInput(true)}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings size={13} />
          </button>
          <button onClick={handleDeleteToken} className="p-2 border border-border rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Run listesi */}
      {loading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Yükleniyor...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Henüz workflow run yok</div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <button
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className="w-full bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors text-left"
            >
              <StatusIcon status={run.status} conclusion={run.conclusion} size={16} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {run.head_commit.message.split('\n')[0]}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">#{run.run_number}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <GitBranch size={11} />
                    {run.head_branch}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <GitCommit size={11} />
                    {run.head_sha.slice(0, 7)}
                  </span>
                  <span className="text-xs text-muted-foreground">{run.actor.login}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(run.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={run.status} conclusion={run.conclusion} />
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
