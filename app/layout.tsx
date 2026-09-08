import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cangzhun-inventory.anew93.chatgpt.site"),
  title: "CANGZHUN · Box Inventory Reconciliation",
  description: "Compare system inventory with daily physical scans by box number. English interface with Chinese guidance.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "CANGZHUN · Box Inventory Reconciliation",
    description: "Compare system locations with daily physical scan locations by box number.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "CANGZHUN · Box Inventory Reconciliation", description: "Compare system locations with daily physical scan locations by box number.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
