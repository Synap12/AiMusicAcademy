import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-txt2 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-cyan text-sm hover:underline">← Back to home</Link>
      <h1 className="text-3xl font-bold mt-4 mb-2 gradient-text">Privacy Policy</h1>
      <p className="text-txt3 text-sm mb-10">Last updated: August 10, 2026 · AI Music Academy, United States</p>

      <Section title="1. Information We Collect">
        <p>
          We collect information you provide directly: account details (email, display
          name, password), profile content (bio, images, social links), uploaded music
          and artwork, community posts and comments, and merchandise listings. We also
          collect usage data such as tracks played, likes, follows, and device/log
          information needed to operate the service.
        </p>
      </Section>
      <Section title="2. How We Use Information">
        <p>
          We use your information to provide streaming and creator services, process
          subscription payments (via Stripe), calculate artist stream earnings, power
          community features, moderate content, and improve the platform. We do not sell
          your personal information and we do not use your data for third-party
          advertising.
        </p>
      </Section>
      <Section title="3. Payments">
        <p>
          Payments are processed by Stripe. We never store full card numbers on our
          servers; Stripe shares only the references we need to manage your
          subscription (customer, subscription, and price identifiers).
        </p>
      </Section>
      <Section title="4. Your California Privacy Rights (CCPA)">
        <p>
          California residents may request access to, deletion of, or a copy of the
          personal information we hold about them, and may not be discriminated against
          for exercising these rights. Submit requests to privacy@aimusicacademy.example.
          We will verify and respond within 45 days.
        </p>
      </Section>
      <Section title="5. Children's Privacy (COPPA)">
        <p>
          AI Music Academy is not directed to children under 13, and we do not knowingly
          collect personal information from children under 13. If we learn that we have
          collected such information, we will delete it promptly. Parents or guardians
          may contact us to request removal.
        </p>
      </Section>
      <Section title="6. Copyright & DMCA">
        <p>
          We respond to notices of alleged copyright infringement under the Digital
          Millennium Copyright Act. Send takedown notices identifying the work, the
          infringing material, and your contact details to dmca@aimusicacademy.example.
          Repeat infringers' accounts are terminated.
        </p>
      </Section>
      <Section title="7. Data Retention & Security">
        <p>
          We retain data for as long as your account is active or as needed to comply
          with legal obligations. Passwords are stored using industry-standard one-way
          hashing, and access to production data is restricted.
        </p>
      </Section>
      <Section title="8. Contact">
        <p>
          Questions about this policy: privacy@aimusicacademy.example.
        </p>
      </Section>
    </div>
  );
}
