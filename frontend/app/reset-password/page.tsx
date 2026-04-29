"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { userAPI } from "@/services/api";

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!token) { setError("Geçersiz link"); return; }
    if (password.length < 6) { setError("Şifre en az 6 karakter olmalı"); return; }
    if (password !== confirm) { setError("Şifreler eşleşmiyor"); return; }
    setLoading(true);
    try {
      await userAPI.resetPassword(token, password);
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "İşlem başarısız. Link geçersiz veya süresi dolmuş olabilir.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Mail size={22} className="text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Yeni Şifre Belirle</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <CheckCircle size={40} className="mx-auto text-primary" />
              <p className="text-sm text-foreground font-medium">Şifreniz güncellendi</p>
              <p className="text-xs text-muted-foreground">Şimdi yeni şifrenizle giriş yapabilirsiniz.</p>
              <a
                href="/"
                className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Giriş Yap
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Yeni Şifre</label>
                <div className="relative flex items-center">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground pr-10"
                  />
                  <button onClick={() => setShowPass(v => !v)} className="absolute right-3 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Şifre Tekrar</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading || !password || !confirm}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
