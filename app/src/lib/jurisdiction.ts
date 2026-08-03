/**
 * Region-aware product flags.
 *
 * Hunter WEZ is a decision aid. In jurisdictions where automated targeting
 * aids may be restricted, keep it off by default so the hunter must opt in.
 * Locale is read from the device — no network, no account.
 *
 * Flag string: WEZ_ENABLED_BY_DEFAULT (Claude.md liability rules).
 */

/** ISO 3166-1 alpha-2 regions where WEZ stays off until the hunter enables it. */
const WEZ_OPT_IN_REGIONS: ReadonlySet<string> = new Set([
  // Placeholder set — expand with counsel before shipping to these markets.
  // Empty for US/CA launch; EU/UK stay opt-in as a conservative default.
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'GB', 'EU',
]);

/** Best-effort device region from locale (e.g. "en-US" → "US"). */
export function deviceRegionCode(): string {
  try {
    const locale =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().locale
        : 'en-US';
    const parts = locale.replace('_', '-').split('-');
    const region = parts.find((p) => p.length === 2 && p === p.toUpperCase());
    return region ?? 'US';
  } catch {
    return 'US';
  }
}

/**
 * Whether Hunter WEZ should show by default in this region.
 * Hunters can still enable it manually in Settings where the product allows.
 */
export const WEZ_ENABLED_BY_DEFAULT: boolean = !WEZ_OPT_IN_REGIONS.has(
  deviceRegionCode(),
);

export function isWezEnabledByDefault(regionCode: string = deviceRegionCode()): boolean {
  return !WEZ_OPT_IN_REGIONS.has(regionCode.toUpperCase());
}
