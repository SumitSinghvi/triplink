import type { Metadata } from "next";
import "./globals.css";
import "./triplink.css";

export const metadata: Metadata = {
  title: "TripLink App Prototype",
  description: "Connect with co-travelers going through the same train and date.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400&display=swap"
        />
      </head>
      <body className="h-full w-full m-0 p-0 overflow-hidden bg-black text-white">
        {children}
      </body>
    </html>
  );
}
