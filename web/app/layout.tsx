import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'أتمتة محادثات الواتساب بالذكاء الاصطناعي | WhatsApp AI Agent',
    template: '%s | WhatsApp AI Agent',
  },
  description:
    'بوت ذكي يرد على عملائك في واتساب على مدار الساعة، يؤهّل العملاء المحتملين ويحوّل المحادثة لفريقك في اللحظة المناسبة. ابدأ تجربتك المجانية.',
  openGraph: {
    type: 'website',
    locale: 'ar_AR',
    title: 'أتمتة محادثات الواتساب بالذكاء الاصطناعي لمشروعك',
    description: 'ردود فورية، تأهيل عملاء، وتسليم سلس للفريق — كل ذلك داخل واتساب.',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plex.variable}>
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-emerald-500/30">
        {children}
      </body>
    </html>
  );
}
