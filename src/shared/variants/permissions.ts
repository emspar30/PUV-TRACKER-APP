// DR1: each app holds only the Android permissions it was reviewed for. A built APK's (or merged
// manifest's) permissions are compared with scripts/variant-permissions.json: a forbidden one, a
// missing required one, or one nobody has reviewed yet each fails the check.

export type VariantPermissionRules = {
  // Must be present
  required: string[];
  // Reviewed and allowed
  allowed: string[];
  // Must never be present, whatever else the list says
  forbidden: string[];
};

export type PermissionCheck = {
  ok: boolean;
  forbidden: string[];
  missing: string[];
  unreviewed: string[];
};

// "{package}" in a rule stands for the app's package (AndroidX adds <package>.DYNAMIC_RECEIVER_...)
const expand = (names: readonly string[], androidPackage: string) => names.map((name) => name.replace('{package}', androidPackage));

export function checkPermissions(found: readonly string[], rules: VariantPermissionRules, androidPackage: string): PermissionCheck {
  const present = new Set(found);
  const forbiddenNames = new Set(expand(rules.forbidden, androidPackage));
  const reviewed = new Set([...expand(rules.required, androidPackage), ...expand(rules.allowed, androidPackage)]);

  const forbidden = [...present].filter((name) => forbiddenNames.has(name)).sort();
  const missing = expand(rules.required, androidPackage).filter((name) => !present.has(name)).sort();
  const unreviewed = [...present].filter((name) => !forbiddenNames.has(name) && !reviewed.has(name)).sort();

  return { ok: forbidden.length === 0 && missing.length === 0 && unreviewed.length === 0, forbidden, missing, unreviewed };
}

// <uses-permission android:name="..."/> entries of a merged AndroidManifest.xml, skipping the ones
// a blockedPermissions entry removes (tools:node="remove")
export function manifestPermissions(xml: string): string[] {
  const names: string[] = [];
  for (const match of xml.matchAll(/<uses-permission(?:-sdk-23)?\b([^>]*)>/g)) {
    const attributes = match[1];
    if (/tools:node\s*=\s*"remove"/.test(attributes)) continue;
    const name = /android:name\s*=\s*"([^"]+)"/.exec(attributes);
    if (name) names.push(name[1]);
  }
  return [...new Set(names)];
}

// Lines of `aapt2 dump permissions <apk>`: "uses-permission: name='android.permission.INTERNET'"
export function aaptPermissions(output: string): string[] {
  const names: string[] = [];
  for (const match of output.matchAll(/uses-permission(?:-sdk-23)?: name='([^']+)'/g)) names.push(match[1]);
  return [...new Set(names)];
}
