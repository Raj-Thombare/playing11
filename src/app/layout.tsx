import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPL XI Builder — Playing XI Broadcast Console (2027 Season Data)",
  description:
    "Build every IPL team's Playing XI with broadcast-TV graphics. AI auto-picks XIs from career IPL records. Full squads, trades, retentions and captains updated to 17 Nov 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
