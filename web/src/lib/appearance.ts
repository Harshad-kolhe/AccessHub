/** Accent presets for the appearance menu. Values must match the [data-accent] blocks in globals.css. */
export const ACCENTS = [
  { id: 'cobalt', label: 'Cobalt', swatch: '#2448d8' },
  { id: 'teal', label: 'Teal', swatch: '#0f766e' },
  { id: 'violet', label: 'Violet', swatch: '#6d28d9' },
  { id: 'amber', label: 'Amber', swatch: '#b45309' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

export const DEFAULT_ACCENT: AccentId = 'cobalt';
/** The person's own choice from the appearance menu. */
export const ACCENT_STORAGE_KEY = 'accesshub-accent';
/** The last organization accent seen in the console, so the next page load paints it straight away. */
export const ORG_ACCENT_STORAGE_KEY = 'accesshub-org-accent';

/**
 * Inlined in <head> so the accent is applied before the first paint (no flash of the default color): the
 * personal choice, else the organization's. It is a constant string: nothing user-controlled is interpolated.
 */
export const accentInitScript = `try{var s=localStorage,a=s.getItem('${ACCENT_STORAGE_KEY}')||s.getItem('${ORG_ACCENT_STORAGE_KEY}');if(${JSON.stringify(
  ACCENTS.map((accent) => accent.id).filter((id) => id !== DEFAULT_ACCENT),
)}.indexOf(a)>-1)document.documentElement.setAttribute('data-accent',a)}catch(e){}`;
