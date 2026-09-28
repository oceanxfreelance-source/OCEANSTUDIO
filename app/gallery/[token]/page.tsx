import type { Metadata } from "next";
import { GalleryExpired, GalleryMessage } from "@/components/gallery/GalleryStates";
import { GalleryLogin } from "@/components/gallery/GalleryLogin";
import { GalleryView } from "@/components/gallery/GalleryView";
import { getClientAccess } from "@/lib/auth/client";
import { clientGallery } from "@/server/deliveries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private Gallery",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

/**
 * Client gallery. Access is decided on the server on every request:
 * token → delivery → not revoked → not expired (server clock) → session.
 */
export default async function GalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await getClientAccess(token);
  switch (access.state) {
    case "ok":
      return <GalleryView token={token} initial={await clientGallery(access.delivery)} />;
    case "login":
      return <GalleryLogin token={token} title={access.delivery.title} />;
    case "expired":
    case "revoked":
      return <GalleryExpired />;
    case "preparing":
      return <GalleryMessage title="Your gallery is being prepared" body="Your photographer just created this gallery. It will be ready in a moment — this page refreshes automatically." refresh />;
    default:
      return <GalleryMessage title="Gallery not found" body="Please check the link you received from your photographer." />;
  }
}
