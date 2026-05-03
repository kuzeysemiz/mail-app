"use client";
import { useState, useEffect, useRef } from "react";
import { Menu, Bell, LogOut } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { userAPI, inboxAPI, authSessionAPI } from "@/services/api";

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
const InboxPanel         = dynamic(() => import("@/components/InboxPanel"),         { ssr: false });

type Screen = "loading" | "login" | "register" | "admin-otp" | "app";

const PAGE_TITLES: Record<string, string> = {
  mailbox:   "Gmail Hesapları",
  add:       "Mail Ekle",
  manage:    "Mail Listeleri",
  logs:      "Gönderim Logları",
  inbox:     "Gelen Kutusu",
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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [credits, setCredits]       = useState<number | null>(null);
  const [unreadInbox, setUnreadInbox]       = useState(0);
  const [inboxOpenKey, setInboxOpenKey]     = useState(0);
  const [inboxAutoOpen, setInboxAutoOpen]   = useState(false);
  const inboxPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setCurrentUserId(r.data.user?.id ?? null);
        if (typeof r.data.credits === 'number') setCredits(r.data.credits);
        setScreen("app");
      })
      .catch(() => setScreen("login"));
  }, []);

  useEffect(() => {
    if (screen !== "app") return;
    const poll = () => inboxAPI.getUnreadCount().then(r => setUnreadInbox(r.data.count ?? 0)).catch(() => {});
    poll();
    inboxPollRef.current = setInterval(poll, 30_000);
    return () => { if (inboxPollRef.current) clearInterval(inboxPollRef.current); };
  }, [screen]);

  const handleUserLogin = (_token: string, _exp: string, user: { id: number; isAdmin: number }) => {
    setIsAdmin(user.isAdmin === 1);
    setCurrentUserId(user.id ?? null);
    setScreen("app");
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setScreen("app");
  };

  const handleTabChange = (tab: string, autoOpen = false) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (tab === "inbox") {
      setInboxAutoOpen(autoOpen);
      setInboxOpenKey(k => k + 1);
    }
  };

  const handleLogout = async () => {
    await authSessionAPI.logout();
    localStorage.removeItem("authToken");
    localStorage.removeItem("authExpiry");
    setScreen("login");
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
        unreadInbox={unreadInbox}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange("inbox", true)}
              className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Gelen Kutusu"
            >
              <Bell size={18} />
              {unreadInbox > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadInbox > 99 ? "99+" : unreadInbox}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Çıkış Yap"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className={cn(
          "flex-1 min-h-0",
          activeTab === "inbox" ? "flex flex-col overflow-hidden p-4 lg:p-6" : "overflow-y-auto p-6 lg:p-8"
        )}>
          {activeTab === "mailbox"   && <MailboxManager />}
          {activeTab === "add"       && <EmailAdder />}
          {activeTab === "manage"    && <EmailManager />}
          {activeTab === "logs"      && <LogViewer />}
          {activeTab === "blacklist" && <BlacklistManager />}
          {activeTab === "deploy"    && <DeployMonitor />}
          {activeTab === "devices"   && <DeviceManager />}
          {activeTab === "admin"     && <AdminPanel currentUserId={currentUserId} />}
          {activeTab === "inbox"     && <InboxPanel key={inboxOpenKey} onUnreadChange={setUnreadInbox} autoOpenUnread={inboxAutoOpen} />}
          {activeTab === "credits"   && <CreditsPanel onCreditsChange={setCredits} />}
        </main>
      </div>
    </div>
  );
}
