import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Nav from "@/components/nav"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "WW Small Engine",
  description: "Shop work order and customer tracker",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-slate-50 min-h-screen`}>
        <Nav />
        <main className="pb-24 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  )
}
