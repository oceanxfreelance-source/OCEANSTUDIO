"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { posterFor, type VideoSource } from "@/lib/video";
import { Play } from "./Icons";

/**
 * Simple, elegant tap-to-play video. Before play only a small cover image
 * loads (nothing heavy on mobile data); after tapping, the video plays inline
 * in its own shape — vertical drone clips stay vertical.
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

  const isFile = source.kind === "file";
  const cover = (isFile ? posterFor(source.url) : null) ?? poster ?? (source.kind === "youtube" ? source.thumbnail : undefined);

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play video: ${title}`}
        className={cx("vf-corners group relative mx-auto flex w-full items-center justify-center overflow-hidden bg-ink text-foam", isFile ? "aspect-[4/5] max-h-[80vh] sm:aspect-video" : "aspect-video")}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" />
        ) : isFile ? (
          // Older upload without a cover frame: show the first frame.
          <video src={`${source.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss/60 via-transparent to-abyss/20" />
        <span className="relative flex flex-col items-center gap-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gold/60 bg-abyss/40 text-gold shadow-2xl backdrop-blur-md transition duration-500 group-hover:scale-105 group-hover:bg-gold group-hover:text-abyss md:h-24 md:w-24">
            <Play className="ml-1 h-7 w-7" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foam/90">Play film</span>
        </span>
      </button>
    );
  }

  if (isFile) {
    return (
      <div className="flex w-full justify-center bg-black">
        <video src={source.url} poster={cover} controls autoPlay playsInline preload="auto" className="max-h-[85vh] w-auto max-w-full" aria-label={title} />
      </div>
    );
  }
  return (
    <div className="relative aspect-video w-full bg-black">
      <iframe src={source.embedUrl} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="absolute inset-0 h-full w-full" />
    </div>
  );
}
