"use client";
import { useState, useEffect, useRef } from "react";
import { Mail, Shield, RefreshCw, LogIn, Clock } from "lucide-react";
import { authAPI } from "@/services/api";

function getDeviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Unknown";
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return {
    browser,
    os,
    platform: navigator.platform || "—",
    screen: `${window.screen.width}×${window.screen.height} (derinlik: ${window.screen.colorDepth}bit)`,
    language: navigator.language || "—",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "—",
    userAgent: ua,
  };
}

function getDeviceName(info: ReturnType<typeof getDeviceInfo>): string {
  return `${info.browser} / ${info.os}`;
}

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [step, setStep]           = useState<"request" | "verify">("request");
  const [code, setCode]           = useState(["", "", "", "", "", ""]);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const inputRefs                 = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef                  = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(120);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestCode = async () => {
    setLoading(true);
    setError("");
    try {
      const deviceId   = getDeviceId();
      const deviceInfo = getDeviceInfo();
      const r = await authAPI.requestCode(deviceId, deviceInfo);
      setMaskedEmail(r.data.email);
      setStep("verify");
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.error || "Kod gönderilemedi. Tekrar deneyin.");
    }
    setLoading(false);
  };

  const handleDigitChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every(d => d)) {
      // Otomatik gönder
      handleVerify(next.join(""));
    }
  };

  const handleDigitKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      const next = text.split("");
      setCode(next);
      inputRefs.current[5]?.focus();
      handleVerify(text);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const finalCode = fullCode || code.join("");
    if (finalCode.length !== 6) { setError("6 haneli kodu girin"); return; }
    setLoading(true);
    setError("");
    try {
      const deviceId   = getDeviceId();
      const deviceInfo = getDeviceInfo();
      const deviceName = getDeviceName(deviceInfo);
      const r = await authAPI.verifyCode(finalCode, deviceId, deviceName);
      localStorage.setItem("authToken", r.data.token);
      localStorage.setItem("authExpiry", r.data.expiresAt);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.error || "Geçersiz kod");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
        {/* Card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, background: "#00c896", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={22} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "#111827" }}>Mail Sistemi</p>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Otomatik Gönderim Paneli</p>
            </div>
          </div>

          {step === "request" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Shield size={18} color="#00c896" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Kimlik Doğrulama</h2>
              </div>
              <p style={{ margin: "0 0 28px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                Panele erişmek için kayıtlı e-posta adresinize bir doğrulama kodu gönderilecektir.
              </p>

              {error && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleRequestCode}
                disabled={loading}
                style={{ width: "100%", padding: "13px 0", background: loading ? "#9ca3af" : "#00c896", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
              >
                <Mail size={17} />
                {loading ? "Gönderiliyor..." : "Kodu Al"}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <LogIn size={18} color="#00c896" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Kodu Girin</h2>
              </div>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#6b7280" }}>
                <strong style={{ color: "#111827" }}>{maskedEmail}</strong> adresine kod gönderildi.
              </p>

              {/* Countdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, marginTop: 8 }}>
                <Clock size={14} color={countdown > 30 ? "#00c896" : "#ef4444"} />
                <span style={{ fontSize: 13, fontWeight: 600, color: countdown > 30 ? "#00c896" : "#ef4444" }}>
                  {countdown > 0 ? `${fmt(countdown)} kaldı` : "Kod süresi doldu"}
                </span>
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
                  {error}
                </div>
              )}

              {/* 6-digit input */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }} onPaste={handlePaste}>
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    disabled={loading || countdown === 0}
                    style={{
                      width: 48, height: 56, textAlign: "center", fontSize: 24, fontWeight: 700,
                      border: `2px solid ${d ? "#00c896" : "#e5e7eb"}`,
                      borderRadius: 10, outline: "none", color: "#111827",
                      background: countdown === 0 ? "#f9fafb" : "#fff",
                      transition: "border-color 0.15s",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerify()}
                disabled={loading || code.some(d => !d) || countdown === 0}
                style={{ width: "100%", padding: "13px 0", background: (loading || code.some(d => !d) || countdown === 0) ? "#9ca3af" : "#00c896", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 12, transition: "background 0.15s" }}
              >
                {loading ? "Doğrulanıyor..." : "Giriş Yap"}
              </button>

              <button
                onClick={handleRequestCode}
                disabled={loading || countdown > 0}
                style={{ width: "100%", padding: "11px 0", background: "transparent", color: countdown > 0 ? "#9ca3af" : "#00c896", border: `1px solid ${countdown > 0 ? "#e5e7eb" : "#00c896"}`, borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: countdown > 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <RefreshCw size={14} />
                {countdown > 0 ? `Yeni kod (${fmt(countdown)})` : "Yeni Kod İste"}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 20 }}>
          © 2026 Mail Sistemi — Yetkisiz erişim yasaktır
        </p>
      </div>
    </div>
  );
}
