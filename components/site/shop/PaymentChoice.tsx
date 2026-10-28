"use client";

import { cx } from "@/components/ui/cx";
import { PAYMENT_LABEL, type PayMethod } from "@/lib/shop-rules";
import { CopyButton } from "./CopyButton";

const HINT: Record<PayMethod, string> = {
  BANK_TRANSFER: "Transfer to our account — or give the cash to your guide and they transfer it. Then upload the slip on the next page (you can send that page to your guide).",
  CASH: "",
};

/** Payment options at checkout and booking. */
export function PaymentChoice({
  methods,
  method,
  onChange,
  bankDetails,
  cashText,
  legend,
}: {
  methods: PayMethod[];
  method: PayMethod;
  onChange: (m: PayMethod) => void;
  bankDetails: string;
  cashText: string;
  legend: string;
}) {
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
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
