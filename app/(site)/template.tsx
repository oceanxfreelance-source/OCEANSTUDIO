/**
 * Re-mounts on every navigation, so each page fades in smoothly.
 * (Layouts persist between pages; templates don't.)
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
