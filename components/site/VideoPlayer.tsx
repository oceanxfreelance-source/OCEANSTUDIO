"use client";

import { useState } from "react";
import type { VideoSource } from "@/lib/video";
import { Play } from "./Icons";

/**
 * Click-to-play video. Nothing heavy loads until the visitor presses play,
 * which keeps pages fast on mobile data.
 */
export function VideoPlayer({ source, poster, title }: { source: VideoSource; poster?: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (source.kind === "link") {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-ink text-foam">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-75" loading="lazy" />
        )}
        <span className="relative flex items-center gap-3 rounded-full bg-abyss/70 px-5 py-3 text-sm backdrop-blur">
          <Play className="h-4 w-4" /> Watch the film
        </span>
      </a>
    );
  }

  const thumb = poster ?? (source.kind === "youtube" ? source.thumbnail : undefined);

  // Uploaded video files: native player. Only a few KB load until play is pressed;
  // without a poster the browser shows the video's first frame.
  if (source.kind === "file") {
    return (
      <video
        src={thumb ? source.url : `${source.url}#t=0.1`}
        poster={thumb}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-black"
        aria-label={title}
      />
    );
  }

  if (!playing) {
    return (
      <button type="button" onClick={() => setPlaying(true)} className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-ink text-foam" aria-label={`Play video: ${title}`}>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.02] group-hover:opacity-100" loading="lazy" />
        )}
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-foam/90 text-abyss shadow-2xl transition-transform group-hover:scale-105 md:h-20 md:w-20">
          <Play className="ml-1 h-6 w-6 md:h-7 md:w-7" />
        </span>
      </button>
    );
  }

  return (
    <div className="relative aspect-video w-full bg-black">
      <iframe
        src={source.embedUrl}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
