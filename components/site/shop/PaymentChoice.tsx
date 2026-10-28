"use client";

import { cx } from "@/components/ui/cx";
import { PAYMENT_LABEL, type PayMethod } from "@/lib/shop-rules";
import { CopyButton } from "./CopyButton";

const HINT: Record<PayMethod, string> = {
  BANK_TRANSFER: "Transfer to our account, then upload the slip on the next page.",
  GUIDE: "Give the cash to your guide. They transfer it to our account and upload the slip — we'll give you a link to send them.",
  CASH: "",
};

/** Payment options at checkout and booking. */
export function PaymentChoice({
  methods,
  method,
  onChange,
  bankDetails,
  cashText,
  guideError,
  legend,
}: {
  methods: PayMethod[];
  method: PayMethod;
  onChange: (m: PayMethod) => void;
  bankDetails: string;
  cashText: string;
  guideError?: string;
  legend: string;
}) {
  const input = "mt-1.5 block w-full rounded-lg border border-foam/20 bg-abyss px-3 py-2.5 text-sm text-foam placeholder:text-foam/35 focus:border-gold focus:outline-none";
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm">{legend}</legend>
      {methods.map((m) => (
        <div key={m} className={cx("rounded-lg border p-4", method === m ? "border-gold bg-gold/5" : "border-foam/10")}>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="radio" name="method" value={m} checked={method === m} onChange={() => onChange(m)} className="accent-[#c9a96e]" />
            {PAYMENT_LABEL[m]}
          </label>
          {method === m && (
            <div className="mt-2 text-xs leading-relaxed text-mist">
              <p>{m === "CASH" ? cashText : HINT[m]}</p>
              {m === "BANK_TRANSFER" && (
                <div className="mt-3 rounded bg-abyss p-3 text-foam/85">
                  <p className="whitespace-pre-line font-mono">{bankDetails}</p>
                  <div className="mt-2 flex justify-end">
                    <CopyButton text={bankDetails} label="Copy details" className="rounded-full border border-gold/60 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-gold" />
                  </div>
                </div>
              )}
              {m === "GUIDE" && (
                <label className="mt-3 block text-foam/85">
                  Your guide&apos;s name or guesthouse
                  <input name="guide" maxLength={100} placeholder="e.g. Ali, Machines Surf Lodge" className={input} />
                  {guideError && <span className="mt-1 block text-red-300">{guideError}</span>}
                </label>
              )}
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
