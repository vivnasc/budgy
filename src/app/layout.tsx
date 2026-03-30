import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { Analytics } from "@/components/shared/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BUDGY - As tuas finanças, simplificadas",
    template: "%s | BUDGY",
  },
  description:
    "Gestão financeira pessoal inteligente. Controla receitas, despesas, orçamentos e metas financeiras.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BUDGY",
  },
  openGraph: {
    type: "website",
    title: "BUDGY",
    description: "As tuas finanças, simplificadas",
    siteName: "BUDGY",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10B981",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans">
        <Analytics domain="budgy.app" />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
