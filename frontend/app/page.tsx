"use client";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";
import { authAPI } from "@/services/api";

const LoginScreen    = dynamic(() => import("@/components/LoginScreen"),    { ssr: false });
const MailboxManager = dynamic(() => import("@/components/MailboxManager"), { ssr: false });
const EmailAdder     = dynamic(() => import("@/components/EmailAdder"),     { ssr: false });
const EmailManager   = dynamic(() => import("@/components/EmailManager"),   { ssr: false });
const LogViewer      = dynamic(() => import("@/components/LogViewer"),      { ssr: false });
const DeviceManager    = dynamic(() => import("@/components/DeviceManager"),    { ssr: false });
const BlacklistManager = dynamic(() => import("@/components/BlacklistManager"), { ssr: false });
const DeployMonitor    = dynamic(() => import("@/components/DeployMonitor"),    { ssr: false });

const PAGE_TITLES: Record<string, string> = {
  mailbox:   "Gmail Hesapları",
  add:       "Mail Ekle",
  manage:    "Mail Listeleri",
  logs:      "Gönderim Logları",
  blacklist: "Kara Liste & Beyaz Liste",
  deploy:    "Deploy Monitörü",
  devices:   "Bağlı Cihazlar",
};

export default function Home() {
  const [activeTab, setActiveTab]     = useState("mailbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // null = henüz kontrol edilmedi, true = giriş yapıldı, false = giriş yapılmadı
  const [authed, setAuthed]           = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token  = localStorage.getItem("authToken");
    const expiry = localStorage.getItem("authExpiry");

    if (!token || !expiry) { setAuthed(false); return; }

    // Client-side expiry kontrolü
    if (new Date(expiry) < new Date()) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authExpiry");
      setAuthed(false);
      return;
    }

    // Sunucudan doğrula
    try {
      await authAPI.me();
      setAuthed(true);
    } catch {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authExpiry");
      setAuthed(false);
    }
  };

  const handleLogin = () => setAuthed(true);

  // Yükleniyor
  if (authed === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#00c896", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Giriş yapılmadı
  if (!authed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Ana uygulama
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Menu size={18} />
            </button>
            <p className="text-sm text-muted-foreground">
              Mail Sistemi /{" "}
              <span className="text-foreground font-medium">{PAGE_TITLES[activeTab]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Aktif</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeTab === "mailbox" && <MailboxManager />}
          {activeTab === "add"     && <EmailAdder />}
          {activeTab === "manage"  && <EmailManager />}
          {activeTab === "logs"    && <LogViewer />}
          {activeTab === "blacklist" && <BlacklistManager />}
          {activeTab === "deploy"    && <DeployMonitor />}
          {activeTab === "devices" && <DeviceManager />}
        </main>
      </div>
    </div>
  );
}
