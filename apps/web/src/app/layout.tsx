import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InfluenceAI — AI Content Command Center',
  description: 'Manage, automate, and scale your AI influencer content across all platforms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
