import type { Metadata } from "next";
import "./globals.css";

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
      <body className="h-full w-full m-0 p-0 overflow-hidden bg-black text-white">
        {children}
      </body>
    </html>
  );
}
