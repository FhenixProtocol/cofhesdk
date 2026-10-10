---
'@cofhe/sdk': patch
---

`fromHexString` and `hexToBytes` now strip the `0x` prefix before padding odd-length strings and validate that the input contains only hexadecimal characters. Previously, padding before stripping `0x` produced strings like `00x123`, preventing prefix removal and corrupting decoded bytes into zeroes and NaN artifacts, while invalid characters silently decoded to zero bytes. Also deduplicated internal `fromHexString` implementations across `@cofhe/sdk/node`, `@cofhe/sdk/web`, and web workers, and replaced deprecated `String.prototype.substr()` in `hexToBytes`.
