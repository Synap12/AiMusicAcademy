import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-txt2 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TermsConditions() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-cyan text-sm hover:underline">← Back to home</Link>
      <h1 className="text-3xl font-bold mt-4 mb-2 gradient-text">Terms & Conditions</h1>
      <p className="text-txt3 text-sm mb-10">Last updated: August 10, 2026 · AI Music Academy, United States</p>

      <Section title="1. The Service">
        <p>
          AI Music Academy is a subscription platform for streaming AI-generated music
          and for artists to publish music, sell merchandise via external stores, and
          earn per-play stream revenue. By creating an account you agree to these Terms.
        </p>
      </Section>
      <Section title="2. Subscriptions & Billing">
        <p>
          Plans bill monthly through Stripe and renew automatically until canceled. You
          can cancel anytime from your profile; access continues through the end of the
          paid period. Fees are non-refundable except where required by law.
        </p>
      </Section>
      <Section title="3. Artist Content & Earnings">
        <p>
          Artists retain ownership of the content they upload and grant us a license to
          host, stream, and display it on the platform. Artists represent that they have
          all rights needed to publish their uploads. Stream earnings accrue per
          qualified play at the platform's published rate and can be withdrawn on
          request; fraudulent play activity voids related earnings.
        </p>
      </Section>
      <Section title="4. Merchandise">
        <p>
          Merch listings link to external stores (e.g. Printful, Shopify, Etsy).
          Purchases occur on those platforms under their terms; we are not a party to
          those transactions and charge no commission.
        </p>
      </Section>
      <Section title="5. Community Rules">
        <p>
          No harassment, hate speech, spam, sexually explicit content, or infringement.
          Posts pass automated profanity screening and may be reported by users and
          removed by moderators. Violations can result in content removal or account
          bans.
        </p>
      </Section>
      <Section title="6. Acceptable Use">
        <p>
          You may not scrape, rip, or redistribute streams; attempt to manipulate play
          counts or earnings; or interfere with the service's operation or security.
        </p>
      </Section>
      <Section title="7. Termination">
        <p>
          You may delete your account at any time. We may suspend or terminate accounts
          that violate these Terms, with notice where practicable.
        </p>
      </Section>
      <Section title="8. Disclaimers & Limitation of Liability">
        <p>
          The service is provided “as is.” To the fullest extent permitted by law, our
          aggregate liability for any claim is limited to the amounts you paid us in the
          twelve months before the claim arose.
        </p>
      </Section>
      <Section title="9. Arbitration Agreement & Class Action Waiver">
        <p>
          Any dispute arising out of these Terms or the service will be resolved by
          binding individual arbitration administered by the American Arbitration
          Association under its Consumer Arbitration Rules, rather than in court, except
          that either party may bring qualifying claims in small-claims court. YOU AND
          AI MUSIC ACADEMY WAIVE THE RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS
          ACTION. You may opt out of arbitration within 30 days of account creation by
          emailing legal@aimusicacademy.example.
        </p>
      </Section>
      <Section title="10. Governing Law & Contact">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA. Contact:
          legal@aimusicacademy.example.
        </p>
      </Section>
    </div>
  );
}
