"use client";

import { useEffect, useRef } from "react";

/** Bump after re-rendering the ad so browsers fetch the new file instead of a cached one. */
const VIDEO_VERSION = 5;
const src = (ext: string) => `/video/kerosop-ad.${ext}?v=${VIDEO_VERSION}`;

/**
 * The product ad (rendered with Remotion from /video). Plays on its own,
 * muted, replaying endlessly while on screen, with no controls. If the
 * browser blocks autoplay, the first click anywhere on the page starts it.
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Autoplay policies check the muted attribute, not only the property.
    v.muted = true;
    v.setAttribute("muted", "");
    v.loop = true;

    let visible = false;
    const tryPlay = () => {
      if (visible) v.play().catch(() => {});
    };
    // Backup for any browser that ignores `loop`: restart from the top.
    const onEnded = () => {
      v.currentTime = 0;
      tryPlay();
    };
    v.addEventListener("ended", onEnded);
    window.addEventListener("pointerdown", tryPlay, { once: true });

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) tryPlay();
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);

    return () => {
      io.disconnect();
      v.removeEventListener("ended", onEnded);
      window.removeEventListener("pointerdown", tryPlay);
    };
  }, []);

  return (
    <div className={`overflow-hidden rounded-[28px] bg-ink ${className}`}>
      <video
        ref={ref}
        className="pointer-events-none block aspect-[1920/780] w-full"
        poster={src("jpg")}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        aria-label="A short animated explainer: KeroSOP reads policies, SOPs and training guides in Chinese and English, finds the clauses that disagree, and lets your reviewer approve the fix. Integrations for Google Drive, Google Docs, Dropbox, Box, Notion, Confluence and WeChat are on the way."
      >
        <source src={src("webm")} type="video/webm" />
        <source src={src("mp4")} type="video/mp4" />
      </video>
    </div>
  );
}
