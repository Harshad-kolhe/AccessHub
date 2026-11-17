import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, ORG_ACCENT_STORAGE_KEY, type AccentId } from './appearance';

/**
 * The accent lives on <html data-accent> (set before first paint by accentInitScript). Components read it as
 * an external store. A personal choice (appearance menu) beats the organization's accent.
 */
const listeners = new Set<() => void>();

export function subscribeAccent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readAccent(): AccentId {
  return (document.documentElement.getAttribute('data-accent') as AccentId | null) ?? DEFAULT_ACCENT;
}

export function isAccent(value: string | null | undefined): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value);
}

function apply(accent: AccentId) {
  if (accent === DEFAULT_ACCENT) document.documentElement.removeAttribute('data-accent');
  else document.documentElement.setAttribute('data-accent', accent);
  listeners.forEach((listener) => listener());
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode): choices last for this page only
  }
}

/** The appearance menu: remember the person's own choice. */
export function choosePersonalAccent(accent: AccentId) {
  try {
    storage()?.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // ignore
  }
  apply(accent);
}

/** Forget the personal choice and fall back to the organization's accent. */
export function clearPersonalAccent() {
  try {
    storage()?.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    // ignore
  }
  const org = storage()?.getItem(ORG_ACCENT_STORAGE_KEY);
  apply(isAccent(org) ? org : DEFAULT_ACCENT);
}

export function hasPersonalAccent(): boolean {
  try {
    return isAccent(storage()?.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** The console: the organization's accent applies unless the person picked their own. */
export function applyOrganizationAccent(accent: string | null) {
  try {
    if (isAccent(accent)) storage()?.setItem(ORG_ACCENT_STORAGE_KEY, accent);
    else storage()?.removeItem(ORG_ACCENT_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (!hasPersonalAccent()) apply(isAccent(accent) ? accent : DEFAULT_ACCENT);
}
