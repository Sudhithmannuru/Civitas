/* Civitas brand mark — a civic arch gateway with dawn rising through it.
   Belonging / welcome into community, in the Dawn / Horizon palette.
   Swap for a real asset later by dropping a PNG/SVG in /public and
   pointing <Logo> at it. */

interface Props {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="cv-ring" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3c7a5a" />
          <stop offset="1" stopColor="#1a271f" />
        </linearGradient>
        <linearGradient id="cv-sky" x1="24" y1="10" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbeacd" />
          <stop offset="0.55" stopColor="#f3d8b9" />
          <stop offset="1" stopColor="#e8a24a" />
        </linearGradient>
        <radialGradient id="cv-sun" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#fff3d6" />
          <stop offset="1" stopColor="#e0934a" />
        </radialGradient>
        <clipPath id="cv-gate">
          <path d="M15 38V22c0-5 4-9 9-9s9 4 9 9v16H15Z" />
        </clipPath>
      </defs>

      {/* Outer civic disc */}
      <circle cx="24" cy="24" r="21" fill="url(#cv-ring)" />
      <circle cx="24" cy="24" r="18.2" fill="#fffefb" fillOpacity="0.12" />

      {/* Dawn sky inside the arch */}
      <g clipPath="url(#cv-gate)">
        <rect x="15" y="13" width="18" height="25" fill="url(#cv-sky)" />
        <circle cx="24" cy="22" r="4.2" fill="url(#cv-sun)" />
        {/* soft ridgeline under the sun */}
        <path d="M15 30c3-3 5-1 7 0s5-2 8 0 4 1 3 2v8H15Z" fill="#79b98c" fillOpacity="0.85" />
        <path d="M15 34c4-2 7 0 9 1s6-1 9 1v3H15Z" fill="#2c5e45" />
      </g>

      {/* Arch frame */}
      <path
        d="M15 38V22c0-5 4-9 9-9s9 4 9 9v16"
        stroke="#fffefb"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Threshold / welcome step */}
      <path d="M13 38h22" stroke="#e8a24a" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
