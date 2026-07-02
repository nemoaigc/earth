import type { Metadata, Viewport } from 'next';
import './globals.css';
// AnimalPanel's stylesheet is global (non-module) CSS. Next only allows global
// CSS to be imported from the root layout, so it lives here, not in the panel.
import '../src/ui/animal-panel.css';

export const metadata: Metadata = {
  title: 'Lost Planet',
  description: 'An interactive memorial to species lost from our world',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Keep the raw Google Fonts <link> so the literal family names
            ("Cormorant Garamond" / "Inter") used in CSS and in JS-built
            styles (e.g. Labels.ts) keep resolving — next/font would hash them. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
