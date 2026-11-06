"use client";

import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { useConsent } from "@/lib/consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** Analytics load only after the visitor accepts in the cookie banner. */
export function ConsentAnalytics() {
  if (useConsent() !== "granted") return null;
  return (
    <>
      <Analytics />
      {GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
