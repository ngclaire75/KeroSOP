"use client";

import { useEffect, useRef, useState } from "react";

/** Bump after re-rendering the ad so browsers fetch the new file instead of a cached one. */
const VIDEO_VERSION = 9;
const src = (ext: string) => `/video/kerosop-ad.${ext}?v=${VIDEO_VERSION}`;

/**
 * The product ad (rendered with Remotion from /video). Plays on its own,
 * muted, replaying while on screen, with an always-visible play/pause button. If the
 * browser blocks autoplay, the first click anywhere on the page starts it.
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Autoplay policies check the muted attribute, not only the property.
    v.muted = true;
    v.setAttribute("muted", "");
    v.loop = true;

    let visible = false;
    const tryPlay = () => {
      if (visible && !userPaused.current) v.play().catch(() => {});
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
    <div className={`relative overflow-hidden rounded-[28px] bg-ink ${className}`}>
      <video
        ref={ref}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
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
        <source src={src("mp4")} type="video/mp4" />
      </video>
      <button
        type="button"
        aria-label={playing ? "Pause video" : "Play video"}
        className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:bottom-5 sm:size-11"
        onClick={() => {
          const video = ref.current;
          if (!video) return;
          if (video.paused) {
            userPaused.current = false;
            video.play().catch(() => {});
          } else {
            userPaused.current = true;
            video.pause();
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          {playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M7 4v16l14-8z" />}
        </svg>
      </button>
    </div>
  );
}
