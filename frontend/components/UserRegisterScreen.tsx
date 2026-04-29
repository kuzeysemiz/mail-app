"use client";
import { useState } from "react";
import { Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { userAPI } from "@/services/api";

interface Props {
  onLogin: () => void;
  onGoLogin: () => void;
}

export default function UserRegisterScreen({ onLogin, onGoLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await userAPI.register(email.trim(), password);
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 size={40} className="text-primary mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Kayıt Tamamlandı</h2>
          <p className="text-sm text-muted-foreground">
            E-posta adresinize doğrulama linki gönderdik. Doğruladıktan sonra giriş yapabilirsiniz.
          </p>
          <button
            onClick={onGoLogin}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Mail size={22} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Hesap Oluştur</h1>
            <p className="text-sm text-muted-foreground mt-1">50 ücretsiz mail ile başla</p>
          </div>
        </div>

        {/* Form */}
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
            <label className="text-xs font-medium text-muted-foreground">Şifre</label>
            <div className="relative flex items-center">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                placeholder="En az 6 karakter"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground pr-10"
              />
              <button onClick={() => setShowPass(v => !v)} className="absolute right-3 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={handleRegister}
            disabled={loading || !email.trim() || !password}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <button onClick={onGoLogin} className="text-primary hover:underline font-medium">
              Giriş Yap
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
