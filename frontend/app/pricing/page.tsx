import { Check, Mail, Zap, Building2 } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Ücretsiz",
    slug: "free",
    price: null,
    credits: 50,
    icon: Mail,
    color: "border-border",
    badge: null,
    features: [
      "50 email kredisi (kayıtta hediye)",
      "Gmail entegrasyonu",
      "Zamanlanmış gönderim",
      "Temel loglar",
    ],
    cta: "Ücretsiz Başla",
    ctaHref: "/",
  },
  {
    name: "Standart",
    slug: "standard",
    price: 400,
    credits: 1000,
    icon: Zap,
    color: "border-primary",
    badge: "Popüler",
    features: [
      "1.000 email kredisi",
      "Gmail entegrasyonu",
      "Toplu & zamanlanmış gönderim",
      "Kara liste & beyaz liste",
      "Gönderim logları",
      "Lead yönetimi",
    ],
    cta: "Satın Al",
    ctaHref: "/?tab=credits",
  },
  {
    name: "Pro",
    slug: "pro",
    price: 1050,
    credits: 3000,
    icon: Zap,
    color: "border-border",
    badge: null,
    features: [
      "3.000 email kredisi",
      "Standart'taki her şey",
      "AI içerik geliştirme",
      "Hunter.io entegrasyonu",
      "Bounce tespiti",
      "Öncelikli destek",
    ],
    cta: "Satın Al",
    ctaHref: "/?tab=credits",
  },
  {
    name: "Kurumsal",
    slug: "enterprise",
    price: null,
    credits: null,
    icon: Building2,
    color: "border-border",
    badge: null,
    features: [
      "Sınırsız kredi (özel teklif)",
      "Pro'daki her şey",
      "Özel entegrasyonlar",
      "SLA garantisi",
      "Özel fiyatlandırma",
    ],
    cta: "Bize Ulaşın",
    ctaHref: "mailto:info@mailsender.app",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mail size={15} className="text-[oklch(0.11_0.005_260)]" />
            </div>
            <span className="text-sm font-bold text-foreground">MailSender</span>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Giriş Yap →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Şeffaf ve Sade Fiyatlar
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Kredi sistemiyle çalışır — fazla ödemezsiniz. Gönderdiğiniz kadar ödersiniz.
          Her kredi 1 email gönderime eşittir.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.slug}
                className={`relative bg-card border-2 ${plan.color} rounded-2xl p-6 flex flex-col gap-5`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] bg-primary text-[oklch(0.11_0.005_260)] font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                  </div>

                  {plan.price ? (
                    <div>
                      <span className="text-3xl font-bold text-foreground">
                        {plan.price.toLocaleString("tr-TR")} ₺
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.credits?.toLocaleString("tr-TR")} kredi ·{" "}
                        {((plan.price / plan.credits!) * 100).toFixed(0)} kr/kredi
                      </p>
                    </div>
                  ) : plan.credits ? (
                    <div>
                      <span className="text-2xl font-bold text-foreground">Ücretsiz</span>
                      <p className="text-xs text-muted-foreground mt-1">{plan.credits} kredi, bir kez</p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold text-foreground">Özel</span>
                      <p className="text-xs text-muted-foreground mt-1">İhtiyacınıza göre teklif</p>
                    </div>
                  )}
                </div>

                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check size={13} className="text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.ctaHref.startsWith("mailto") ? (
                  <a
                    href={plan.ctaHref}
                    className="block text-center py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={plan.ctaHref}
                    className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 ${
                      plan.color === "border-primary"
                        ? "bg-primary text-[oklch(0.11_0.005_260)]"
                        : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Pay-as-you-go note */}
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            Krediler tek seferlik satın alınır, abonelik yoktur.
            Kredileriniz bittiğinde istediğiniz paketi tekrar satın alabilirsiniz.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 text-center">
        <p className="text-xs text-muted-foreground">© 2026 MailSender · Tüm hakları saklıdır</p>
      </footer>
    </div>
  );
}
