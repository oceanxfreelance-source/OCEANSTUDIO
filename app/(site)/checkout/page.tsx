import type { Metadata } from "next";
import { getShopConfig, paymentMethods } from "@/lib/shop";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cfg = await getShopConfig();
  return (
    <section className="min-h-screen bg-abyss pb-24 pt-32 text-foam md:pt-40">
      <div className="container-x">
        <p className="eyebrow eyebrow-line text-gold">Checkout</p>
        <h1 className="display mt-4 text-4xl [font-stretch:112%] md:text-6xl">Your clips</h1>
        <div className="mt-10">
          <CheckoutForm prices={cfg.prices} methods={paymentMethods(cfg)} bankDetails={cfg.bankDetails} cashText={cfg.cashText} />
        </div>
      </div>
    </section>
  );
}
