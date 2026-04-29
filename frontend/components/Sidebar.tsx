"use client";
import { Mail, Plus, List, BarChart2, Monitor, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "mailbox",   label: "Hesaplar",       icon: Mail },
  { id: "add",       label: "Mail Ekle",      icon: Plus },
  { id: "manage",    label: "Yönet",          icon: List },
  { id: "logs",      label: "Loglar",         icon: BarChart2 },
  { id: "blacklist", label: "Kara Liste",     icon: ShieldAlert },
  { id: "devices",   label: "Bağlı Cihazlar", icon: Monitor },
];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }: Props) {
  const handleNav = (id: string) => { onTabChange(id); onClose(); };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 flex flex-col",
          "bg-card border-r border-border",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0 lg:shrink-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Mail size={17} className="text-[oklch(0.11_0.005_260)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">Mail Sistemi</p>
              <p className="text-[11px] text-muted-foreground mt-1">Otomatik Gönderim</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                activeTab === id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
              )}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Sistem Aktif</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <button
              onClick={() => handleNav("deploy")}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              deploy
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">© 2026 MailSender</p>
        </div>
      </aside>
    </>
  );
}
