import type {Metadata} from 'next';
import { DM_Mono, Syne } from 'next/font/google';
import './globals.css';

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
});

export const metadata: Metadata = {
  title: 'Sozo Discovery',
  description: 'Forensic Material Intelligence',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${dmMono.variable} ${syne.variable}`} style={{ backgroundColor: '#000000' }}>
      <body suppressHydrationWarning className="bg-black text-[#f0f0f0] font-mono selection:bg-[#e8ff00] selection:text-black" style={{ backgroundColor: '#000000', color: '#f0f0f0' }}>
        {children}
        <div className="fixed inset-0 pointer-events-none z-50 scanlines" />
      </body>
    </html>
  );
}
