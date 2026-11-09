import test from 'node:test'
import assert from 'node:assert/strict'
import { vendorModuleKey } from '../scripts/react-vendor-policy.mjs'
test('React 18 transitive CDN imports share the root React module identity', () => {
  const urls = { react: 'https://esm.unpkg.com/react@18.3.1?dev', 'react-dom-client': 'https://esm.unpkg.com/react-dom@18.3.1/client?dev&external=react' }
  for (const suffix of ['', '?dev', '?dev=', '?external=react&dev=']) assert.equal(vendorModuleKey(`https://esm.unpkg.com/react@18.3.1${suffix}`, urls), 'react')
  assert.equal(vendorModuleKey(urls['react-dom-client'], urls), 'react-dom-client')
  for (const url of ['https://esm.unpkg.com/react@18.3.1/jsx-runtime', 'https://esm.unpkg.com/scheduler@0.23.2', 'https://esm.unpkg.com/react@19.2.6']) assert.equal(Buffer.from(vendorModuleKey(url, urls), 'base64url').toString(), url)
})
