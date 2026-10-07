import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

// ---------------------------------------------------------------------------
// EDIT BEFORE PUBLISHING: replace the bracketed details below, and have these
// texts reviewed for your business and country. They are a starting point,
// not legal advice.
// ---------------------------------------------------------------------------
const COMPANY = '[Your legal business name]';
const CONTACT_EMAIL = '[support@yourdomain.com]';
const COUNTRY = '[Your country]';
const UPDATED = 'October 7, 2026';

type Section = { h: string; p: string[] };

const PAGES: Record<'terms' | 'privacy' | 'refunds', { title: string; sections: Section[] }> = {
  terms: {
    title: 'Terms of Service',
    sections: [
      { h: 'Who we are', p: [`Reputation Engine is provided by ${COMPANY}, ${COUNTRY} ("we", "us"). By creating an account or using the service you agree to these terms.`] },
      { h: 'The service', p: ['Reputation Engine helps businesses manage reviews, review requests, their Google listing, website SEO checks, social posts, leads and reports. Features may change as we improve the product.'] },
      { h: 'Your account', p: ['You must give accurate information and keep your login secure. You are responsible for activity on your account and for the people you invite to your business.'] },
      { h: 'Acceptable use', p: [
        'Do not use the service to send spam, to contact people who have not done business with you, to post fake or incentivised reviews, or to break any law or the rules of platforms you connect (such as Google or Meta).',
        'Only check websites you own or are allowed to audit, and do not attempt to disrupt or reverse-engineer the service.',
      ] },
      { h: 'Your content', p: ['You keep ownership of the content and data you add. You give us permission to process it only to provide the service to you.'] },
      { h: 'AI features', p: ['Some features use AI to draft replies, posts and recommendations. Review AI output before using it; you are responsible for what you publish.'] },
      { h: 'Plans and payments', p: ['Paid plans are billed in advance on a recurring basis through our reseller, Lemon Squeezy, who acts as merchant of record and handles payments, invoices and taxes. You can cancel any time; your plan stays active until the end of the paid period.'] },
      { h: 'Third-party services', p: ['The service connects to third parties such as Google, Meta, Resend and Lemon Squeezy. Their terms apply to your use of them, and we are not responsible for their availability.'] },
      { h: 'Availability and liability', p: ['We work to keep the service reliable but provide it "as is", without guarantees of specific results such as rankings or review counts. To the extent allowed by law, our total liability is limited to the amount you paid us in the 12 months before a claim.'] },
      { h: 'Ending your use', p: ['You can stop using the service and ask us to delete your account at any time. We may suspend accounts that break these terms.'] },
      { h: 'Changes and contact', p: [`We may update these terms and will notify you of material changes. Questions: ${CONTACT_EMAIL}.`] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: 'Overview', p: [`This policy explains how ${COMPANY} ("we") handles personal data in Reputation Engine. Contact: ${CONTACT_EMAIL}.`] },
      { h: 'What we collect', p: [
        'Account data: your name, email address and sign-in details.',
        'Business data you add or connect: business details, reviews, leads and customer contact details, social posts, website addresses and reports.',
        'Connected-account data: information from services you connect, such as Google Business Profile and Search Console, with your permission.',
        'Usage data: basic logs needed to run, secure and improve the service.',
      ] },
      { h: 'How we use it', p: ['To provide the service, send emails you or your team trigger (such as review requests, alerts and weekly summaries), keep accounts secure, provide support and handle billing. We do not sell personal data.'] },
      { h: 'Your customers’ data', p: ['When you add customer details (for example to send a review request), you are responsible for having a lawful basis to contact them. We process that data on your behalf and only for that purpose.'] },
      { h: 'Service providers', p: ['We use trusted providers to run the service: Supabase (hosting and database), Anthropic (AI drafting), Google APIs (listing, Search Console, PageSpeed), Resend (email) and Lemon Squeezy (payments). They process data only as needed to provide their service to us.'] },
      { h: 'Retention and deletion', p: ['We keep data while your account is active. You can delete content in the app or ask us to delete your account, after which we remove your data within a reasonable period unless the law requires us to keep it.'] },
      { h: 'Your rights', p: [`Depending on where you live, you may have the right to access, correct, export or delete your data, or object to processing. Email ${CONTACT_EMAIL} to make a request.`] },
      { h: 'Security', p: ['Data is encrypted in transit, access is restricted by business and role, and connected-account credentials are stored server-side only.'] },
      { h: 'Changes', p: ['We may update this policy and will notify you of material changes.'] },
    ],
  },
  refunds: {
    title: 'Refund Policy',
    sections: [
      { h: 'Free plan first', p: ['You can use Reputation Engine on the Free plan before paying, so you can see whether it suits your business.'] },
      { h: 'Cancelling', p: ['You can cancel a paid plan at any time from Settings → Plan & billing → Manage billing. You keep paid features until the end of the current billing period and are not charged again.'] },
      { h: 'Refunds', p: [
        'If you are not happy with a new paid subscription, contact us within 14 days of your first payment for a full refund.',
        'Renewal payments are generally not refunded, but contact us if something went wrong and we will look at it fairly.',
      ] },
      { h: 'How to ask', p: [`Email ${CONTACT_EMAIL} from your account email with your business name. Approved refunds are issued through Lemon Squeezy to your original payment method.`] },
    ],
  },
};

export function LegalPage({ page }: { page: keyof typeof PAGES }) {
  const content = PAGES[page];
  useEffect(() => {
    document.title = `${content.title} · Reputation Engine`;
    window.scrollTo(0, 0);
  }, [content.title]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" aria-label="Reputation Engine home"><Logo /></Link>
          <Link to="/signup" className="btn-primary text-sm">Start free</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{content.title}</h1>
        <p className="text-sm text-slate-500 mt-2">Last updated {UPDATED}</p>
        <div className="mt-8 space-y-7">
          {content.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-slate-900">{s.h}</h2>
              {s.p.map((para) => (
                <p key={para} className="mt-2 text-slate-600 leading-relaxed">{para}</p>
              ))}
            </section>
          ))}
        </div>
        <nav className="mt-12 pt-6 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-900">Home</Link>
          <Link to="/terms" className="hover:text-slate-900">Terms</Link>
          <Link to="/privacy" className="hover:text-slate-900">Privacy</Link>
          <Link to="/refunds" className="hover:text-slate-900">Refunds</Link>
        </nav>
      </main>
    </div>
  );
}
