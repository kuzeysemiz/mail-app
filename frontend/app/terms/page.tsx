export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using MailSender ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>MailSender is an email automation platform that allows users to schedule and send emails through their own Gmail accounts. Users purchase email credits to send automated emails via the platform.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>You must register for an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Credits and Payments</h2>
            <p>The Service operates on a credit-based system. Credits are purchased in advance and consumed at a rate of 1 credit per email sent. Credits are non-transferable and have no cash value. All purchases are final and processed through Paddle.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Acceptable Use</h2>
            <p>You agree not to use the Service to send spam, unsolicited bulk email, or any content that violates applicable laws. You are solely responsible for the content of emails sent through the platform. We reserve the right to suspend accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:info@mailsender.app" className="text-primary hover:underline">info@mailsender.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
