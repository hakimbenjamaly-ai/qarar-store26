import type { Metadata } from "next";
import "./globals.css";
import { brandVars, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.storeName, template: `%s | ${s.storeName}` },
    description: s.tagline || s.storeName,
    icons: s.logoUrl ? [{ url: s.logoUrl }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: brandVars(s.brandColor) }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
