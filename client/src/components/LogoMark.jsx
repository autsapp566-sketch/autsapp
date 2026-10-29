/** Cut-out of the ECOM JOIN mark (transparent background). */
export function LogoMark({ className = 'h-9 w-9' }) {
  return <img src="/ecom-mark.png" alt="" className={`object-contain ${className}`} />;
}

export function Wordmark({ tone = 'onDark' }) {
  const ecom = tone === 'onLight' ? 'text-[#D8560F]' : 'text-[#F26B1D]';
  const join = tone === 'onLight' ? 'text-[#0E7490]' : 'text-[#2ED4DE]';
  return (
    <span
      className="text-[15px] font-extrabold leading-none tracking-[0.06em]"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <span className={ecom}>ECOM</span> <span className={join}>JOIN</span>
    </span>
  );
}

export function BrandLockup({ tone = 'onDark', className = '' }) {
  return (
    <span dir="ltr" className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <Wordmark tone={tone} />
    </span>
  );
}
