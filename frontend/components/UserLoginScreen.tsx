"use client";
import { useState } from "react";
import { Mail, Eye, EyeOff } from "lucide-react";
import { userAPI } from "@/services/api";

interface Props {
  onLogin: (token: string, expiresAt: string, user: { id: number; email: string; isAdmin: number }) => void;
  onGoRegister: () => void;
  onGoAdminLogin: () => void;
}

export default function UserLoginScreen({ onLogin, onGoRegister, onGoAdminLogin }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [forgot, setForgot]     = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [otpStep, setOtpStep]   = useState(false);
  const [otpUserId, setOtpUserId] = useState<number | null>(null);
  const [otp, setOtp]           = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      const r = await userAPI.login(email.trim(), password);
      if (r.data.requiresOtp) {
        setOtpUserId(r.data.userId);
        setOtpStep(true);
      } else {
        const { token, expiresAt, user } = r.data;
        localStorage.setItem("authToken", token);
        localStorage.setItem("authExpiry", expiresAt);
        onLogin(token, expiresAt, user);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || !otpUserId) return;
    setError("");
    setLoading(true);
    try {
      const r = await userAPI.verifyOtp(otpUserId, otp.trim());
      const { token, expiresAt, user, deviceId } = r.data;
      localStorage.setItem("authToken", token);
      localStorage.setItem("authExpiry", expiresAt);
      if (deviceId) localStorage.setItem("deviceId", deviceId);
      onLogin(token, expiresAt, user);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Kod hatalı veya süresi dolmuş");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("E-posta girin"); return; }
    setLoading(true);
    try {
      await userAPI.forgotPassword(email.trim());
      setForgotDone(true);
    } catch {
      setError("İstek gönderilemedi");
    } finally {
      setLoading(false);
    }
  };

  if (otpStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Mail size={22} className="text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">Doğrulama Kodu</h1>
              <p className="text-sm text-muted-foreground mt-1">{email} adresine kod gönderildi</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">6 Haneli Kod</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                placeholder="000000"
                className="w-full px-3.5 py-3 bg-input border border-border rounded-lg text-lg font-mono text-center outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground tracking-widest"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Doğrulanıyor..." : "Doğrula"}
            </button>

            <button
              onClick={() => { setOtpStep(false); setOtp(""); setError(""); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (forgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Şifre Sıfırlama</h2>
          {forgotDone ? (
            <p className="text-sm text-muted-foreground">
              E-posta adresinize sıfırlama linki gönderdik.
            </p>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="E-posta adresiniz"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                onClick={handleForgot}
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Gönderiliyor..." : "Link Gönder"}
              </button>
            </>
          )}
          <button onClick={() => { setForgot(false); setForgotDone(false); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground">
            ← Geri
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Mail size={22} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Giriş Yap</h1>
            <p className="text-sm text-muted-foreground mt-1">Mail Otomasyon Sistemi</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Şifre</label>
              <button onClick={() => setForgot(true)} className="text-xs text-muted-foreground hover:text-primary">
                Şifremi unuttum
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground pr-10"
              />
              <button onClick={() => setShowPass(v => !v)} className="absolute right-3 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading || !email.trim() || !password}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Hesabın yok mu?{" "}
            <button onClick={onGoRegister} className="text-primary hover:underline font-medium">
              Kayıt Ol
            </button>
          </p>
        </div>

        <p className="text-center">
          <button onClick={onGoAdminLogin} className="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
            yönetici girişi
          </button>
        </p>
      </div>
    </div>
  );
}
