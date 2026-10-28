import type { MediaRef } from "@/lib/public";
import { cx } from "@/components/ui/cx";

/**
 * Responsive, lazy-loaded image for uploaded media.
 * Phones download the ~900px thumbnail; large screens the 2400px version.
 */
export function Img({
  media,
  alt,
  sizes = "100vw",
  className,
  priority = false,
}: {
  media: MediaRef;
  alt?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const thumbW = Math.min(900, media.width);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/media/${media.id}`}
      srcSet={`/media/${media.id}?size=thumb ${thumbW}w, /media/${media.id} ${media.width}w`}
      sizes={sizes}
      width={media.width}
      height={media.height}
      alt={alt ?? media.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cx("h-full w-full object-cover", className)}
    />
  );
}
