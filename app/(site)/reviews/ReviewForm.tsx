"use client";

import { useActionState, useState } from "react";
import { StarShape } from "@/components/site/Stars";
import { cx } from "@/components/ui/cx";
import { submitReview, type ReviewState } from "./actions";

const input =
  "w-full rounded-none border-0 border-b border-deep/20 bg-transparent px-0 py-3 text-base text-deep placeholder:text-slate/60 focus:border-deep focus:outline-none focus:ring-0";
const LABELS = ["", "Poor", "Okay", "Good", "Great", "Amazing"];

export function ReviewForm({ thanks }: { thanks: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, { status: "idle" });
  const v = state.status === "error" ? state.values : {};
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const [rating, setRating] = useState<number>(Number(v.rating) || 0);
  const [hover, setHover] = useState(0);

  if (state.status === "sent") {
    return (
      <div role="status" className="border border-deep/10 bg-white/60 p-8">
        <p className="eyebrow text-gold-deep">Review sent</p>
        <p className="display mt-4 text-3xl [font-stretch:112%]">{thanks}</p>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form action={action} noValidate className="space-y-7">
      {state.status === "error" && (
        <p role="alert" className="border-l-2 border-coral bg-coral/10 px-4 py-3 text-sm text-deep">
          {state.error}
        </p>
      )}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="eyebrow text-slate">
          How would you rate our drone videography? <span className="text-coral">*</span>
        </legend>
        <input type="hidden" name="rating" value={rating || ""} />
        <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              aria-pressed={rating === i}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <StarShape className={cx("h-9 w-9 transition-colors", i <= shown ? "text-gold" : "text-deep/15")} />
            </button>
          ))}
          <span className="ml-3 text-sm text-slate">{LABELS[shown]}</span>
        </div>
        {fe.rating && <p className="mt-2 text-sm text-coral">{fe.rating}</p>}
      </fieldset>

      <div>
        <label htmlFor="text" className="eyebrow block text-slate">
          Your note about the drone videography <span className="text-coral">*</span>
        </label>
        <textarea
          id="text"
          name="text"
          rows={4}
          maxLength={1500}
          defaultValue={v.text}
          className={cx(input, "resize-y")}
          placeholder="How did your drone clips from Machines turn out? The angles, the edit, the experience…"
        />
        {fe.text && <p className="mt-2 text-sm text-coral">{fe.text}</p>}
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="eyebrow block text-slate">
            Your name <span className="text-coral">*</span>
          </label>
          <input id="name" name="name" autoComplete="name" defaultValue={v.name} className={input} placeholder="First name is fine" />
          {fe.name && <p className="mt-2 text-sm text-coral">{fe.name}</p>}
        </div>
        <div>
          <label htmlFor="instagram" className="eyebrow block text-slate">
            Instagram (optional)
          </label>
          <input id="instagram" name="instagram" autoCapitalize="none" autoCorrect="off" defaultValue={v.instagram} className={input} placeholder="@yourname" />
          {fe.instagram && <p className="mt-2 text-sm text-coral">{fe.instagram}</p>}
        </div>
      </div>

      <p className="text-xs text-slate">Your name, Instagram, stars and note will be shown publicly after we check the review.</p>
      <button type="submit" disabled={pending} className="w-full rounded-full bg-abyss px-8 py-5 text-[12px] font-semibold tracking-[0.18em] text-foam hover:bg-ink-2 disabled:opacity-60 sm:w-auto">
        {pending ? "SENDING…" : "SEND REVIEW"}
      </button>
    </form>
  );
}
