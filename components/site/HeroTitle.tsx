import { Fragment } from "react";

/**
 * Headline whose words rise into place one after another (pure CSS — see
 * .hero-word in globals.css). The text stays normal, selectable text.
 */
export function AnimatedWords({ text, delayStart = 0 }: { text: string; delayStart?: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="hero-word">
            <span style={{ "--i": i + delayStart } as React.CSSProperties}>{w}</span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
