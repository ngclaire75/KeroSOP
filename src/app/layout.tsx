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
  metadataBase: new URL("https://kerosop.site"),
  alternates: { canonical: "/" },
  title: "KeroSOP — Find where your SOPs disagree",
  description:
    "KeroSOP reads your policies, SOPs and training guides in Chinese and English, finds instructions that conflict, and shows both clauses word for word.",
  // the share image itself comes from app/opengraph-image.jpg and app/twitter-image.jpg
  openGraph: {
    type: "website",
    url: "https://kerosop.site",
    siteName: "KeroSOP",
    title: "KeroSOP — Find where your SOPs disagree",
    description: "Not a chatbot. A quality check for the rules your staff follow, in Chinese and English, with both clauses quoted word for word.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KeroSOP — Find where your SOPs disagree",
    description: "Not a chatbot. A quality check for the rules your staff follow, in Chinese and English, with both clauses quoted word for word.",
  },
};

// Runs before the page paints. Every first load starts at the very top: the
// browser neither restores the last scroll position nor jumps to a #section.
const bootScript = [
  "document.documentElement.classList.add('js')",
  "history.scrollRestoration='manual'",
  "if(location.hash)history.replaceState(history.state,'',location.pathname+location.search)",
  "window.scrollTo(0,0)",
  // iOS Safari and in-app browsers (Instagram, LinkedIn, Facebook, Chrome on
  // iOS: all WebKit) zoom into any input under 16px on focus. maximum-scale=1
  // stops that; iOS still allows pinch zoom. Next.js rewrites the viewport tag
  // on navigation, so it is re-applied whenever the head changes. Android never
  // auto-zooms, so its pinch zoom is left alone.
  "if(/iP(hone|od|ad)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){var v=function(){document.querySelectorAll('meta[name=viewport]').forEach(function(m){if(m.content.indexOf('maximum-scale=1')<0)m.content=m.content.replace(/,?\\s*maximum-scale=[^,]*/,'')+', maximum-scale=1'})};v();document.addEventListener('DOMContentLoaded',function(){v();new MutationObserver(v).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})})}",
].join(";");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${notoSC.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
