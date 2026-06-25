import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Nav from "@/components/nav"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const viewport: Viewport = {
  themeColor: "#f97316",
}

export const metadata: Metadata = {
  title: "WW Small Engine",
  description: "Wade & Wayne Small Engine Repair - Shop Management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WW Engine",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable + " font-sans bg-slate-50 min-h-screen"}>
        <Nav />
        <main className="pb-24 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  )
}
