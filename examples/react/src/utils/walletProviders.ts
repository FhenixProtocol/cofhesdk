// OKX Wallet claims window.ethereum and sets isMetaMask: true to impersonate
// MetaMask. It also does not implement EIP-5749's `providers` array, so when
// both wallets are installed, a naive injected() connector silently binds to
// OKX instead of MetaMask.
//
// A direct property read (`provider.isOkxWallet`) is NOT reliable:
// OKX's injected Proxy returns `undefined` for that read while still showing
// `isOkxWallet: true` when the object is enumerated ({...provider},
// console.log, JSON.stringify). This points to a Proxy whose `get` trap
// behaves differently from its `ownKeys`/`getOwnPropertyDescriptor` traps.
// Use spread-based enumeration instead of direct property access.
function isOkxFlagged(provider: any): boolean {
  if (!provider) return false
  try {
    const enumerated = { ...provider }
    return !!(enumerated.isOkxWallet || enumerated.isOKExWallet)
  } catch {
    return false
  }
}

/** Resolves the genuine MetaMask provider, rejecting any OKX impersonator. */
export function pickMetaMaskProvider(window: any): any {
  const eth = window?.ethereum
  const okx = window?.okxwallet
  if (!eth) return undefined

  // Prefer EIP-5749 providers array when present
  const candidates =
    Array.isArray(eth.providers) && eth.providers.length > 0
      ? eth.providers
      : [eth]

  return candidates.find((p: any) => {
    if (!p?.isMetaMask) return false
    // Identity check: if window.ethereum IS window.okxwallet,
    // it's OKX impersonating MetaMask — object identity is unfakeable
    if (okx && p === okx) return false
    return !isOkxFlagged(p)
  })
}

/** Resolves OKX Wallet via window.okxwallet — this slot cannot be impersonated. */
export function pickOkxProvider(window: any): any {
  return window?.okxwallet
}
