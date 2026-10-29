'use client';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-white">تعذّر تحميل لوحة المدير</h1>
      <p className="text-sm leading-6 text-slate-400">{error.message || 'حدث خطأ غير متوقع.'}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
