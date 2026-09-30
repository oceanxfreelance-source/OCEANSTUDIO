import { ImageResponse } from "next/og";

// Default social-share image (used when a page has no photo of its own).
export const alt = "OCEAN X — Surf films & photography at Machines, Maabaidhoo, Maldives";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#eef1ee",
          background: "radial-gradient(70% 90% at 25% 20%, #1f5e64 0%, #0a1217 55%, #04080b 100%)",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 10 }}>MACHINES • MAABAIDHOO • LAAMU</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 124, fontWeight: 700, letterSpacing: 6 }}>
            <span>OCEAN</span><span style={{ color: "#7cc6c9", marginLeft: 24 }}>X</span>
          </div>
          <div style={{ fontSize: 38, color: "#b9c6cc", marginTop: 12 }}>Surf films & photography at Machines, Maabaidhoo</div>
        </div>
      </div>
    ),
    size,
  );
}
