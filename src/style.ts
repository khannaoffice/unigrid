import type { CSSProperties } from 'react'

export function protectStyle(
  input: CSSProperties | undefined,
  canonical: CSSProperties,
  protectedKeys: ReadonlySet<string>,
): CSSProperties {
  const safe: Record<string, string | number | undefined> = {}

  if (input) {
    for (const [key, value] of Object.entries(input)) {
      if (!protectedKeys.has(key)) safe[key] = value
    }
  }

  for (const [key, value] of Object.entries(canonical)) safe[key] = value
  return safe as CSSProperties
}
