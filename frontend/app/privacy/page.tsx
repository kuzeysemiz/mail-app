export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p>We collect information you provide when registering, including your email address and password (stored as a secure hash). We also collect usage data such as emails sent, credit transactions, and login activity.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve the Service, process payments, send transactional emails (such as email verification and password reset), and ensure the security of your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Data Storage</h2>
            <p>Your data is stored on secure servers. We do not store your Gmail app passwords in plain text — they are stored encrypted and used solely to authenticate with Gmail SMTP on your behalf.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Third-Party Services</h2>
            <p>We use Paddle for payment processing. Paddle acts as the Merchant of Record and handles all payment data. We do not store credit card information. Please review <a href="https://www.paddle.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Paddle's Privacy Policy</a> for details.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Data Sharing</h2>
            <p>We do not sell or share your personal data with third parties, except as required by law or to provide the Service (e.g., payment processors).</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Cookies</h2>
            <p>We use session-based authentication tokens stored in your browser's local storage. We do not use tracking cookies or third-party analytics.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Your Rights</h2>
            <p>You may request deletion of your account and associated data at any time by contacting us. We will process deletion requests within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Contact</h2>
            <p>For privacy-related questions, contact us at <a href="mailto:info@mailsender.app" className="text-primary hover:underline">info@mailsender.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
