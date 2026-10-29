import Link from 'next/link';

/** Cut-out of the ECOM JOIN mark (transparent background). */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src="/ecom-mark.png" alt="" className={`object-contain ${className}`} />;
}

export function Wordmark({ tone = 'onDark' }: { tone?: 'onDark' | 'onLight' }) {
  const ecom = tone === 'onLight' ? 'text-[#0B1C33]' : 'text-white';
  return (
    <span
      className={`text-[15px] font-extrabold leading-none tracking-[0.06em] ${ecom}`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      ECOM <span className="text-[#2FE0DE]">JOIN</span>
    </span>
  );
}

export function Logo({ className = '', tone = 'onDark' }: { className?: string; tone?: 'onDark' | 'onLight' }) {
  return (
    <Link href="/" dir="ltr" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="ECOM JOIN">
      <LogoMark />
      <Wordmark tone={tone} />
    </Link>
  );
}
