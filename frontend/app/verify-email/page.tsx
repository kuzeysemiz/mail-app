"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { userAPI } from "@/services/api";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Geçersiz doğrulama linki");
      return;
    }
    userAPI.verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(e => {
        setStatus("error");
        setMessage(e.response?.data?.error || "Doğrulama başarısız");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-5 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Mail size={22} className="text-primary-foreground" />
          </div>
        </div>

        {status === "loading" && (
          <>
            <Loader2 size={32} className="animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">E-posta doğrulanıyor...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={40} className="mx-auto text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">E-posta doğrulandı</h2>
              <p className="text-sm text-muted-foreground mt-1">Hesabınız aktif edildi. Şimdi giriş yapabilirsiniz.</p>
            </div>
            <a
              href="/"
              className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Giriş Yap
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={40} className="mx-auto text-destructive" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Doğrulama başarısız</h2>
              <p className="text-sm text-muted-foreground mt-1">{message || "Bu link geçersiz veya süresi dolmuş."}</p>
            </div>
            <a
              href="/"
              className="block w-full py-2.5 border border-border text-muted-foreground rounded-lg text-sm hover:text-foreground transition-colors"
            >
              Ana Sayfaya Dön
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
