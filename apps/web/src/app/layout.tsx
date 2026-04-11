import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { Toaster } from 'sonner';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'InfluenceAI — AI Content Command Center',
  description: 'Manage, automate, and scale your AI influencer content across all platforms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
