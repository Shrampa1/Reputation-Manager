import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  FileText,
  Gauge,
  Globe,
  Inbox,
  MessageSquareReply,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Swords,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { supabase } from '@/lib/supabase';

interface PublicPlan {
  id: string;
  name: string;
  price_label: string;
  features: string[];
}

// Shown if the plans table can't be read (e.g. before its migration runs)
const FALLBACK_PLANS: PublicPlan[] = [
  { id: 'free', name: 'Free', price_label: '$0', features: ['Review inbox & AI replies', 'Google listing & Search Console', '3 website checks a day', '25 review requests a month', '1 competitor'] },
  { id: 'pro', name: 'Pro', price_label: '$29 / month', features: ['Everything in Free', '25 website checks a day', '500 review requests a month', '5 competitors', 'Up to 5 team members', 'White-label PDF reports'] },
  { id: 'agency', name: 'Agency', price_label: '$99 / month', features: ['Everything in Pro', 'Manage up to 10 businesses', '100 website checks a day', '2,000 review requests a month', '10 competitors per business', 'Up to 25 team members'] },
];

const FEATURES = [
  { icon: MessageSquareReply, title: 'Reviews & AI replies', text: 'All your reviews in one inbox. Claude drafts a warm, on-brand reply in seconds; you approve it.' },
  { icon: Send, title: 'Review requests', text: 'Email happy customers a one-tap rating link. Unhappy ones can tell you privately first.' },
  { icon: Globe, title: 'Google listing', text: 'Your Google rating and latest reviews, plus a check that your name, address and phone match everywhere.' },
  { icon: Search, title: 'Search Console', text: 'See which pages Google has indexed, the searches you show up for, clicks and rankings.' },
  { icon: Gauge, title: 'Website health', text: 'Indexing, on-page SEO, broken links and Core Web Vitals, scored out of 100, with an AI fix plan.' },
  { icon: CalendarDays, title: 'AI social planner', text: 'Describe your goals and get a week of posts for Facebook, Instagram and Google, ready to schedule.' },
  { icon: Inbox, title: 'Leads & pipeline', text: 'Track every enquiry from first contact to completed job, then ask for a review in one click.' },
  { icon: Swords, title: 'Competitors', text: 'Compare ratings, reviews, site speed and SEO with up to 10 competitors and see where they’re ahead.' },
  { icon: BellRing, title: 'Alerts & reports', text: 'Get emailed if your site goes down or drops out of Google, a weekly summary, and white-label PDF reports.' },
];

const STORE_CHECKS = [
  'Detects Shopify, WooCommerce, Magento, BigCommerce and more',
  'Checks product pages for Product markup, price and stock',
  'Flags missing review stars, SKUs/GTINs and image alt text',
  'Mobile speed and Core Web Vitals for real shoppers',
  'Plain-English fixes with steps for your store platform',
];

const FAQ = [
  { q: 'Who is Reputation Engine for?', a: 'Local service businesses (plumbers, salons, clinics, restaurants…), online stores, and agencies that manage several clients.' },
  { q: 'Do I need a credit card to start?', a: 'No. The Free plan is free forever. Upgrade only when you need more checks, review requests or businesses.' },
  { q: 'Which accounts can I connect?', a: 'Google Business Profile listing (rating and reviews), Google Search Console, and your website. Social publishing connects Facebook, Instagram and Google where available.' },
  { q: 'Does it change anything on my website?', a: 'No. Website checks only read your public pages, and Search Console access is read-only. The fix plan tells you what to change.' },
  { q: 'Can I use my own branding for client reports?', a: 'Yes. Add your logo and colours, and hide the Reputation Engine credit for white-label PDF reports.' },
  { q: 'Can I cancel any time?', a: 'Yes. Paid plans are monthly and can be cancelled from the billing portal; you keep the plan until the end of the period.' },
];

/** Static product preview for the hero (illustrative numbers, built from real UI pieces). */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="absolute -inset-6 bg-gradient-to-br from-sky-200/60 via-indigo-200/40 to-transparent blur-3xl rounded-full" />
      <div className="relative grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl bg-white shadow-xl shadow-slate-900/5 border border-slate-100 p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">JS</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Jane S.</p>
                <span className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">“Came the same day and fixed our water heater. Fair price, super friendly.”</p>
              <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-100">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 uppercase tracking-wider"><Sparkles className="w-3 h-3" /> AI draft reply</p>
                <p className="text-sm text-slate-700 mt-1">Thank you, Jane! We’re so glad we could get your hot water back the same day. See you next time!</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white shadow-xl shadow-slate-900/5 border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Google rating</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">4.8<span className="text-amber-400">★</span></p>
          <p className="text-xs text-emerald-600 font-medium mt-1">+0.2 this month</p>
        </div>
        <div className="rounded-2xl bg-white shadow-xl shadow-slate-900/5 border border-slate-100 p-4 flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-slate-100" />
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-emerald-500" strokeDasharray="94.2" strokeDashoffset="13" />
          </svg>
          <div>
            <p className="text-xs text-slate-500">Site health</p>
            <p className="text-2xl font-bold text-slate-900">86</p>
          </div>
        </div>
        <div className="col-span-2 rounded-2xl bg-white shadow-xl shadow-slate-900/5 border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Google search clicks</p>
            <p className="text-xs text-emerald-600 font-medium">↑ 18%</p>
          </div>
          <div className="flex items-end gap-1 h-12 mt-3">
            {[30, 42, 38, 50, 46, 58, 55, 64, 60, 72, 70, 82].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-sky-400 to-indigo-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>(FALLBACK_PLANS);

  useEffect(() => {
    document.title = 'Reputation Engine: more reviews, better rankings, more customers';
    supabase
      .from('plans')
      .select('id, name, price_label, features')
      .order('sort')
      .then(({ data, error }) => {
        if (!error && data?.length) setPlans(data as PublicPlan[]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Link to="/" aria-label="Reputation Engine home"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#stores" className="hover:text-slate-900">For online stores</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn-ghost text-sm !px-2 sm:!px-3">Sign in</Link>
            <Link to="/signup" className="btn-primary text-sm">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50/70 to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-20 lg:pt-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-sky-100 text-xs font-medium text-sky-700 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> For local businesses, online stores & agencies
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              More reviews. Better rankings.{' '}
              <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">More customers.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
              Reputation Engine brings your reviews, Google listing, website SEO, social posts and leads into one dashboard, with AI
              that tells you exactly what to do next.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/signup" className="btn-primary !px-6 !py-3 text-base">Start free <ArrowRight className="w-4 h-4" /></Link>
              <a href="#pricing" className="btn-secondary !px-6 !py-3 text-base">See pricing</a>
            </div>
            <p className="mt-4 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> Free plan</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> No card needed</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> Set up in minutes</span>
            </p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Works with */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500">
          <span className="font-medium text-slate-400">Works with</span>
          {['Google Business Profile', 'Google Search Console', 'PageSpeed Insights', 'Shopify', 'WooCommerce', 'WordPress'].map((n) => (
            <span key={n} className="font-semibold text-slate-600">{n}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 scroll-mt-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-sky-600">Everything in one place</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Stop juggling five tools to look good online</h2>
          <p className="mt-4 text-slate-600">From the first Google search to the five-star review, Reputation Engine covers every step and points you to the next best action.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-100 p-6 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/50 transition-all">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 text-sky-600">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Online stores */}
      <section id="stores" className="bg-slate-900 text-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-300"><ShoppingBag className="w-4 h-4" /> Built for online stores too</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Get your products seen in Google</h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Point it at your store or any product page. Reputation Engine checks what Google needs to show your price, stock and star
              ratings, and how fast your pages load for shoppers on their phones.
            </p>
            <Link to="/signup" className="mt-8 btn-primary !px-6 !py-3">Check my store free <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <ul className="space-y-3">
            {STORE_CHECKS.map((c) => (
              <li key={c} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-400/15 text-emerald-300 shrink-0"><Check className="w-4 h-4" /></span>
                <span className="text-slate-200">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">Up and running in three steps</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {[
            { n: 1, icon: Globe, title: 'Add your business', text: 'Create your account, then connect your Google listing and website.' },
            { n: 2, icon: Gauge, title: 'Get your scores', text: 'See your rating, site health, search performance and how you compare with competitors.' },
            { n: 3, icon: FileText, title: 'Follow the plan', text: 'Reply to reviews, ask for new ones and fix what the AI plan flags. Track progress every week.' },
          ].map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-slate-50 p-6">
              <span className="absolute top-5 right-5 text-5xl font-bold text-slate-200">{s.n}</span>
              <s.icon className="w-6 h-6 text-sky-600" />
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gradient-to-b from-white to-sky-50/60 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple pricing</h2>
            <p className="mt-3 text-slate-600">Start free. Upgrade when you need more. Cancel any time.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5 items-stretch">
            {plans.map((p) => {
              const featured = p.id === 'pro';
              return (
                <div key={p.id} className={`relative rounded-2xl bg-white p-7 flex flex-col border ${featured ? 'border-sky-300 shadow-xl shadow-sky-100' : 'border-slate-200'}`}>
                  {featured && <span className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold">Most popular</span>}
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="mt-2 text-3xl font-bold">{p.price_label}</p>
                  <ul className="mt-6 space-y-2.5 text-sm text-slate-600 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{f}</li>
                    ))}
                  </ul>
                  <Link to="/signup" className={`${featured ? 'btn-primary' : 'btn-secondary'} w-full mt-7`}>
                    {p.id === 'free' ? 'Start free' : `Start with ${p.name}`}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Prices in USD. Applicable taxes are added at checkout.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-20 scroll-mt-16">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">Questions</h2>
        <div className="mt-10 divide-y divide-slate-100 border-y border-slate-100">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-slate-900">
                {f.q}
                <span className="ml-4 text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 px-6 py-14 text-center text-white">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10" />
          <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight">See how your business looks online</h2>
          <p className="relative mt-3 text-white/85">Free plan, no card needed. Your first website check takes about a minute.</p>
          <Link to="/signup" className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-sky-700 hover:bg-sky-50">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-slate-500">Reviews, SEO and growth for local businesses and online stores.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <Link to="/terms" className="hover:text-slate-900">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link to="/refunds" className="hover:text-slate-900">Refunds</Link>
            <Link to="/login" className="hover:text-slate-900">Sign in</Link>
          </nav>
        </div>
        <p className="text-center text-xs text-slate-400 pb-8">© {new Date().getFullYear()} Reputation Engine. All rights reserved.</p>
      </footer>
    </div>
  );
}
