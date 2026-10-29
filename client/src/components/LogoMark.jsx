/** Same ECOM JOIN mark used on the marketing site. */
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M34 18 L22 34" stroke="#7fdbef" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 36 L28 46" stroke="#6b8fb3" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M40 22 L48 32" stroke="#8fd8ea" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="30" cy="50" r="5.5" fill="#16324d" />
      <circle cx="28.2" cy="48.2" r="1.6" fill="#ffffff" opacity="0.28" />
      <circle cx="20" cy="36" r="8" fill="#10283f" />
      <circle cx="17.2" cy="33.2" r="2.4" fill="#ffffff" opacity="0.22" />
      <circle cx="50" cy="34" r="4.2" fill="#1c4468" />
      <circle cx="48.6" cy="32.4" r="1.3" fill="#ffffff" opacity="0.25" />
      <circle cx="38" cy="16" r="11" fill="#2fe0de" />
      <circle cx="34" cy="12.5" r="4" fill="#ffffff" opacity="0.55" />
      <circle cx="41.5" cy="19" r="2.2" fill="#0e7490" opacity="0.35" />
    </svg>
  );
}

export function Wordmark({ tone = 'onDark' }) {
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

export function BrandLockup({ tone = 'onDark', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <Wordmark tone={tone} />
    </span>
  );
}
