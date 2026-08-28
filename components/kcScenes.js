// Line-art scene marks for the public pages.
//
// Owner, 27 Aug, on the kosher-phone section: a comparison "with chasidic
// line-art cards". Separate from kcIcons.js on purpose — that file is a 24-grid
// icon family with a stated contract (20px, 1.5 stroke, one glyph per idea) and
// these are illustrations: a 48-grid, a lighter line, and a whole small scene
// rather than a symbol.
//
// Drawn rather than photographed because the brand standard treats that as a
// decision and not a gap: community norms around imagery rule out the
// lifestyle photography retail leans on, so typography, flat colour and
// instrument marks do the work. These are objects and places — a shtender, a
// pair of candlesticks, a case, a satchel — with no people in them. The scene
// is carried by what is in it, which is also the only way to draw this without
// putting a face on a page where a face would be wrong.
//
// currentColor throughout, so a card decides the ink and both themes come out
// right with no second palette.

const scene = {
  width: 56, height: 56, viewBox: '0 0 48 48', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.35,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}

// A shtender with an open sefer on it — the beis medrash.
export const ShtenderScene = (p) => (
  <svg {...scene} {...p}>
    {/* the open sefer, two leaves meeting at the spine */}
    <path d="M24 13.5c-2.6-1.9-5.6-2.6-8.6-2.6v9.9c3 0 6 .7 8.6 2.6" />
    <path d="M24 13.5c2.6-1.9 5.6-2.6 8.6-2.6v9.9c-3 0-6 .7-8.6 2.6" />
    <path d="M24 13.5v9.9" />
    {/* the sloped top it rests on */}
    <path d="M13.4 21.6h21.2l1.6 4.2H11.8z" />
    {/* the column and the foot */}
    <path d="M20.6 25.8v13.4M27.4 25.8v13.4" />
    <path d="M16.8 39.2h14.4" />
  </svg>
)

// Two licht in their leuchters — erev Shabbos, at home.
export const LichtScene = (p) => (
  <svg {...scene} {...p}>
    {[18, 30].map((x) => (
      <g key={x}>
        {/* flame */}
        <path d={`M${x} 8.5c1.9 1.7 2.8 3.2 2.8 4.6a2.8 2.8 0 0 1-5.6 0c0-1.4.9-2.9 2.8-4.6z`} />
        {/* candle, cup, stem, foot */}
        <path d={`M${x - 1.7} 16.8v6.4h3.4v-6.4`} />
        <path d={`M${x - 3.6} 23.2h7.2l-1.5 2.9h-4.2z`} />
        <path d={`M${x} 26.1v10.2`} />
        <path d={`M${x - 4.4} 36.3h8.8`} />
      </g>
    ))}
    {/* the cloth they stand on */}
    <path d="M9 39.6h30" />
  </svg>
)

// A case with its handle and a luggage tag — away from home.
export const CaseScene = (p) => (
  <svg {...scene} {...p}>
    <path d="M18.5 12.5v-2.2a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2.2" />
    <rect x="9.5" y="12.5" width="29" height="24" rx="3" />
    <path d="M17.5 12.5v24M30.5 12.5v24" />
    <path d="M14.5 36.5v3M33.5 36.5v3" />
    {/* the tag on the handle */}
    <path d="M29.5 10.3h4.6l1.8 2.3-1.8 2.3h-4.6z" />
  </svg>
)

// A satchel with its strap and buckles — a first phone, for school.
export const SatchelScene = (p) => (
  <svg {...scene} {...p}>
    <path d="M15 17.5c0-4.4 4-8 9-8s9 3.6 9 8" />
    <path d="M11.5 17.5h25a2 2 0 0 1 2 2v16a3 3 0 0 1-3 3h-23a3 3 0 0 1-3-3v-16a2 2 0 0 1 2-2z" />
    <path d="M11.5 17.5v7.6c0 .9.8 1.6 1.7 1.6h21.6c.9 0 1.7-.7 1.7-1.6v-7.6" />
    <path d="M19.5 26.7v3.1M28.5 26.7v3.1" />
  </svg>
)

export const SCENES = {
  shtender: ShtenderScene,
  licht: LichtScene,
  case: CaseScene,
  satchel: SatchelScene,
}
