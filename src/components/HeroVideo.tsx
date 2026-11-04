"use client";

import { useEffect, useRef, useState } from "react";

/** Bump after re-rendering the ad so browsers fetch the new file instead of a cached one. */
const VIDEO_VERSION = 9;
const src = (ext: string) => `/video/kerosop-ad.${ext}?v=${VIDEO_VERSION}`;

/**
 * The product ad starts paused on every device. Only the centered button
 * starts playback; after that it loops muted while on screen.
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    v.loop = true;
    v.pause();

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
        className="group absolute inset-0 grid place-items-center rounded-[28px] text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
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
        <span className={`grid size-12 place-items-center rounded-full bg-black/75 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none sm:size-14 ${playing ? "opacity-0 group-focus-visible:opacity-100" : "opacity-100"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            {playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M7 4v16l14-8z" />}
          </svg>
        </span>
      </button>
    </div>
  );
}
