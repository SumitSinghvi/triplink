import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './triplink.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TripLink - Co-Traveler & Professional Networking',
  description: 'Meet verified business contacts and co-travelers on your train or flight before boarding.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className={`${geistSans.variable} ${geistMono.variable} h-full w-full m-0 p-0 overflow-hidden bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
