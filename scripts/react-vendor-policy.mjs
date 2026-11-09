export function vendorModuleKey(url, vendorUrls) {
  const selected = new URL(vendorUrls.react)
  const requested = new URL(url)
  if (requested.origin === selected.origin && requested.pathname === selected.pathname) return 'react'
  for (const [key, value] of Object.entries(vendorUrls)) if (value === url) return key
  return Buffer.from(url).toString('base64url')
}
