import { redirect } from "next/navigation";
import { getContent } from "@/lib/content";
import { instagramDmUrl } from "@/lib/format";

/**
 * Short link for the Instagram bio: /book opens a DM to Ocean X on Instagram
 * (or the Contact page until the Instagram username has been added).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const dm = instagramDmUrl((await getContent())["social.instagram"]);
  redirect(dm ?? "/contact");
}
