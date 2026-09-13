/**
 * Font registry.
 *
 * Each
 * entry points at a class in `src/styles/fonts.css` that sets the same
 * `--font-*` variable. Nothing else about the font switcher changed: the class
 * names are applied to `<body>` and `globals.css` reads the variables.
 */

interface FontEntry {
  label: string;
  /** Class that defines the family's CSS variable. */
  font: { variable: string };
}

export const fontRegistry = {
  geist: { label: "Geist", font: { variable: "font-geist" } },
  inter: { label: "Inter", font: { variable: "font-inter" } },
  notoSans: { label: "Noto Sans", font: { variable: "font-noto-sans" } },
  nunitoSans: { label: "Nunito Sans", font: { variable: "font-nunito-sans" } },
  figtree: { label: "Figtree", font: { variable: "font-figtree" } },
  roboto: { label: "Roboto", font: { variable: "font-roboto" } },
  raleway: { label: "Raleway", font: { variable: "font-raleway" } },
  dmSans: { label: "DM Sans", font: { variable: "font-dm-sans" } },
  publicSans: { label: "Public Sans", font: { variable: "font-public-sans" } },
  outfit: { label: "Outfit", font: { variable: "font-outfit" } },
  geistMono: { label: "Geist Mono", font: { variable: "font-geist-mono" } },
  geistPixelSquare: { label: "Geist Pixel Square", font: { variable: "font-geist-pixel-square" } },
  jetBrainsMono: { label: "JetBrains Mono", font: { variable: "font-jetbrains-mono" } },
  notoSerif: { label: "Noto Serif", font: { variable: "font-noto-serif" } },
  robotoSlab: { label: "Roboto Slab", font: { variable: "font-roboto-slab" } },
  merriweather: { label: "Merriweather", font: { variable: "font-merriweather" } },
  lora: { label: "Lora", font: { variable: "font-lora" } },
  playfairDisplay: { label: "Playfair Display", font: { variable: "font-playfair-display" } },
} as const satisfies Record<string, FontEntry>;

export type FontKey = keyof typeof fontRegistry;

export const fontVars = (Object.values(fontRegistry) as Array<(typeof fontRegistry)[FontKey]>)
  .map((f) => f.font.variable)
  .join(" ");

export const fontOptions = (Object.entries(fontRegistry) as Array<[FontKey, (typeof fontRegistry)[FontKey]]>).map(
  ([key, f]) => ({
    key,
    label: f.label,
    variable: f.font.variable,
  }),
);
