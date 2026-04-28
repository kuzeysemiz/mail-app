"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";

const MailboxManager = dynamic(() => import("@/components/MailboxManager"), { ssr: false });
const EmailAdder     = dynamic(() => import("@/components/EmailAdder"),     { ssr: false });
const EmailManager   = dynamic(() => import("@/components/EmailManager"),   { ssr: false });
const LogViewer      = dynamic(() => import("@/components/LogViewer"),      { ssr: false });

const PAGE_TITLES: Record<string, string> = {
  mailbox: "Gmail Hesapları",
  add:     "Mail Ekle",
  manage:  "Mail Listeleri",
  logs:    "Gönderim Logları",
};

export default function Home() {
  const [activeTab, setActiveTab]     = useState("mailbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeTab === "mailbox" && <MailboxManager />}
          {activeTab === "add"     && <EmailAdder />}
          {activeTab === "manage"  && <EmailManager />}
          {activeTab === "logs"    && <LogViewer />}
        </main>
      </div>
    </div>
  );
}
