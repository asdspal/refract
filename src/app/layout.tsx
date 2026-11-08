import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refract — Private x402 API Pass",
  description:
    "Cross-chain, yield-bearing zkAPI clearinghouse and x402 facilitator on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className="site-header" role="banner">
          <a href="/" className="brand">
            REFRACT // 402
          </a>
          <nav className="nav" aria-label="Primary">
            <a href="/studio">Studio</a>
            <a href="/playground">Playground</a>
            <a href="/merchant">Merchant</a>
          </nav>
        </header>
        <main id="main" role="main">
          {children}
        </main>
      </body>
    </html>
  );
}
