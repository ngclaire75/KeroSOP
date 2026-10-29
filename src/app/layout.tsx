import type { Metadata } from "next";
import { Archivo, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Chinese quotes and document names. Served in unicode-range slices, so only
// the glyphs a page uses are downloaded.
const notoSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "KeroSOP — Find where your SOPs disagree",
  description:
    "KeroSOP reads your policies, SOPs and training guides in Chinese and English, finds instructions that conflict, and shows both clauses word for word.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${notoSC.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
