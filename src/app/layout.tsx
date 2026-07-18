import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monzurul Islam | Junior Software Engineer",
  description: "Personal portfolio website of Monzurul Islam (Irfan), showcase of software engineering projects, technical skills, education timeline, and contact information.",
  keywords: ["Monzurul Islam", "Irfan", "Software Engineer", "Backend Developer", "Django", "Python", "Next.js", "TypeScript", "Chattogram", "Bangladesh"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} data-theme="night">
      <head />
      <body className="font-sans antialiased bg-base-100 text-base-content min-h-screen relative">
        {children}
      </body>
    </html>
  );
}
