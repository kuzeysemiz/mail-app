export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Refund Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Credit Purchases</h2>
            <p>All credit purchases are final. Once credits have been added to your account, they are non-refundable unless required by applicable law.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Eligibility for Refund</h2>
            <p>We may issue a refund in the following circumstances:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>You were charged but credits were not added to your account due to a technical error.</li>
              <li>You were charged multiple times for the same purchase.</li>
              <li>A refund is required under applicable consumer protection laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. How to Request a Refund</h2>
            <p>To request a refund, contact us at <a href="mailto:info@mailsender.app" className="text-primary hover:underline">info@mailsender.app</a> within 14 days of your purchase. Please include your account email and the transaction date. We will review your request and respond within 5 business days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Unused Credits</h2>
            <p>Unused credits do not expire and remain in your account indefinitely. We do not offer refunds for unused credits beyond the 14-day window.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Payment Processing</h2>
            <p>All payments are processed by Paddle, our payment provider. Approved refunds will be credited to your original payment method within 5–10 business days, depending on your bank or card issuer.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Contact</h2>
            <p>For refund requests or questions, reach us at <a href="mailto:info@mailsender.app" className="text-primary hover:underline">info@mailsender.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
