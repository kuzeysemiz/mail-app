"use client";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";
import { userAPI } from "@/services/api";

const LoginScreen        = dynamic(() => import("@/components/LoginScreen"),        { ssr: false });
const UserLoginScreen    = dynamic(() => import("@/components/UserLoginScreen"),    { ssr: false });
const UserRegisterScreen = dynamic(() => import("@/components/UserRegisterScreen"), { ssr: false });
const MailboxManager     = dynamic(() => import("@/components/MailboxManager"),     { ssr: false });
const EmailAdder         = dynamic(() => import("@/components/EmailAdder"),         { ssr: false });
const EmailManager       = dynamic(() => import("@/components/EmailManager"),       { ssr: false });
const LogViewer          = dynamic(() => import("@/components/LogViewer"),          { ssr: false });
const BlacklistManager   = dynamic(() => import("@/components/BlacklistManager"),   { ssr: false });
const DeployMonitor      = dynamic(() => import("@/components/DeployMonitor"),      { ssr: false });
const DeviceManager      = dynamic(() => import("@/components/DeviceManager"),      { ssr: false });
const AdminPanel         = dynamic(() => import("@/components/AdminPanel"),         { ssr: false });
const CreditsPanel       = dynamic(() => import("@/components/CreditsPanel"),       { ssr: false });

type Screen = "loading" | "login" | "register" | "admin-otp" | "app";

const PAGE_TITLES: Record<string, string> = {
  mailbox:   "Gmail Hesapları",
  add:       "Mail Ekle",
  manage:    "Mail Listeleri",
  logs:      "Gönderim Logları",
  blacklist: "Kara Liste & Beyaz Liste",
  deploy:    "Deploy Monitörü",
  devices:   "Bağlı Cihazlar",
  admin:     "Admin Paneli",
  credits:   "Krediler",
};

export default function Home() {
  const [screen, setScreen]         = useState<Screen>("loading");
  const [activeTab, setActiveTab]   = useState("mailbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [credits, setCredits]       = useState<number | null>(null);

  useEffect(() => {
    const token  = localStorage.getItem("authToken");
    const expiry = localStorage.getItem("authExpiry");
    if (!token || !expiry || new Date(expiry) < new Date()) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authExpiry");
      setScreen("login");
      return;
    }
    userAPI.me()
      .then(r => {
        setIsAdmin(r.data.user?.isAdmin === 1 || r.data.user?.isAdmin === true);
        if (typeof r.data.credits === 'number') setCredits(r.data.credits);
        setScreen("app");
      })
      .catch(() => setScreen("login"));
  }, []);

  const handleUserLogin = (_token: string, _exp: string, user: { isAdmin: number }) => {
    setIsAdmin(user.isAdmin === 1);
    setScreen("app");
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setScreen("app");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  if (screen === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #1a2235", borderTopColor: "#00c896", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <UserRegisterScreen
        onLogin={() => setScreen("app")}
        onGoLogin={() => setScreen("login")}
      />
    );
  }

  if (screen === "admin-otp") {
    return <LoginScreen onLogin={handleAdminLogin} />;
  }

  if (screen === "login") {
    return (
      <UserLoginScreen
        onLogin={handleUserLogin}
        onGoRegister={() => setScreen("register")}
        onGoAdminLogin={() => setScreen("admin-otp")}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        credits={credits}
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
          {activeTab === "mailbox"   && <MailboxManager />}
          {activeTab === "add"       && <EmailAdder />}
          {activeTab === "manage"    && <EmailManager />}
          {activeTab === "logs"      && <LogViewer />}
          {activeTab === "blacklist" && <BlacklistManager />}
          {activeTab === "deploy"    && <DeployMonitor />}
          {activeTab === "devices"   && <DeviceManager />}
          {activeTab === "admin"     && <AdminPanel />}
          {activeTab === "credits"   && <CreditsPanel onCreditsChange={setCredits} />}
        </main>
      </div>
    </div>
  );
}
