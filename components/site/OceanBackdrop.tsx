/**
 * Default cinematic background used until a real hero photo is uploaded:
 * deep water gradients, drifting light and slow swell lines. Pure CSS/SVG —
 * weighs almost nothing on mobile.
 */
export function OceanBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-abyss">
      <div className="animate-drift absolute -inset-[20%] bg-[radial-gradient(60%_50%_at_30%_35%,rgba(28,44,66,0.75),transparent_70%),radial-gradient(40%_40%_at_75%_60%,rgba(201,169,110,0.16),transparent_70%),radial-gradient(80%_60%_at_50%_120%,rgba(7,8,10,1),transparent_70%)]" />
      <svg className="animate-swell absolute bottom-0 left-0 h-[55%] w-[110%] opacity-40" viewBox="0 0 1200 400" preserveAspectRatio="none">
        {Array.from({ length: 14 }, (_, i) => {
          const y = 60 + i * 24;
          const a = 10 + i * 2.2;
          return (
            <path
              key={i}
              d={`M0 ${y} C 150 ${y - a}, 300 ${y + a}, 450 ${y} S 750 ${y - a}, 900 ${y} S 1100 ${y + a}, 1200 ${y}`}
              fill="none"
              stroke="rgba(230,215,185,0.55)"
              strokeWidth={0.6 + i * 0.05}
              opacity={0.15 + i * 0.05}
            />
          );
        })}
      </svg>
      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
    </div>
  );
}
