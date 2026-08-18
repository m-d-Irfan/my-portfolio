import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { PortfolioProvider } from "@/context/PortfolioContext";
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
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} data-theme="night" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme') || 'night';
                  document.documentElement.setAttribute('data-theme', savedTheme);
                  document.body.style.backgroundColor = savedTheme === 'light' ? '#faf8f2' : '#100e0b';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased text-base-content min-h-screen relative">
        <PortfolioProvider>
          {children}
        </PortfolioProvider>
      </body>
    </html>
  );
}
