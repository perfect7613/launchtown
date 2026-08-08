import { useState } from 'react';
import { useLaunchTown } from '../launchtown/useLaunchTown';

function normalizeUrl(raw: string): string | undefined {
  let candidate = raw.trim();
  if (!candidate) return undefined;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export default function Onboarding() {
  const { createProduct } = useLaunchTown();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const url = normalizeUrl(value);
    if (!url) {
      setError('Enter a valid website URL, e.g. https://ledgerly-demo.vercel.app');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await createProduct(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 lg:mt-16 px-4">
      <div className="lt-panel p-8 sm:p-10 text-center">
        <div className="text-lg sm:text-xl text-clay-100/80 mb-2 font-body tracking-wide">
          Rehearse your launch before a single real user arrives
        </div>
        <h2 className="font-display text-3xl sm:text-5xl text-white tracking-wider mb-8">
          Whose launch are we rehearsing?
        </h2>
        <form
          className="flex flex-col sm:flex-row gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            type="text"
            inputMode="url"
            placeholder="https://ledgerly-demo.vercel.app"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-grow rounded-md border-2 border-clay-500 bg-[#10131f] px-4 py-3 text-lg text-white placeholder:text-clay-500 focus:border-yellow-400 focus:ring-0 font-body"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-display tracking-wider text-xl px-6 py-3 shadow-[0_4px_0_#92620b]"
          >
            {busy ? 'Populating…' : 'Populate the town'}
          </button>
        </form>
        {error && <div className="mt-3 text-red-400 text-base">{error}</div>}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-sm text-clay-100/80">
          <div className="lt-step">
            <span className="lt-step-num">1</span> Claude reads your site and builds a product
            model
          </div>
          <div className="lt-step">
            <span className="lt-step-num">2</span> 8 residents with memories &amp; relationships
            start talking
          </div>
          <div className="lt-step">
            <span className="lt-step-num">3</span> Word of mouth changes how they browse it — in
            real browsers
          </div>
        </div>
      </div>
    </div>
  );
}
