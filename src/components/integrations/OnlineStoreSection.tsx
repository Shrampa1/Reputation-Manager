import { ExternalLink, ShoppingBag } from 'lucide-react';

/** Where the companion store builder lives. Override with VITE_MULTISTORE_URL once it has its own domain. */
const MULTISTORE_URL = (import.meta.env.VITE_MULTISTORE_URL as string | undefined)?.replace(/\/$/, '') || 'https://multistore-neon.vercel.app';

/** "Online store" add-on: link a Multistore shop so delivered orders ask for reviews automatically. */
export function OnlineStoreSection() {
  return (
    <section id="online-store" className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-orange-50 text-orange-600">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900">Online store</h2>
            <span className="badge bg-orange-50 text-orange-700">Multistore</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Sell online with your own store (cash on delivery, cards and local couriers). Once it’s linked, every delivered order
            asks the customer for a review, and your best reviews appear on the store.
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2 text-sm text-slate-600 list-decimal pl-5">
        <li>
          Create your store on Multistore, or open the one you already have.
        </li>
        <li>
          Here, under <a href="#api" className="font-medium text-sky-600 hover:text-sky-700">Zapier, Make &amp; API</a>, create an API key
          named “Online store”.
        </li>
        <li>
          In Multistore, go to <b>Settings → Reputation Engine</b>, paste the key and switch on <b>Ask for a review when an order is delivered</b>.
        </li>
        <li>
          Optional: in the theme editor, add the <b>Reputation Engine reviews</b> section to your home or product page. Switch the
          widget on first in Settings → Website reviews widget.
        </li>
      </ol>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <a href={`${MULTISTORE_URL}/signup`} target="_blank" rel="noreferrer" className="btn-primary text-sm">
          <ShoppingBag className="w-4 h-4" />
          Create a store
        </a>
        <a href={`${MULTISTORE_URL}/dashboard`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
          <ExternalLink className="w-4 h-4" />
          Open my store
        </a>
      </div>
      <p className="text-xs text-slate-400 mt-3">API keys are part of the Pro and Agency plans.</p>
    </section>
  );
}
