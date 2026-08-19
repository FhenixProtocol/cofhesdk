---
'@cofhe/react': minor
---

Support confidential tokens whose public (underlying) and confidential sides use different decimals (e.g. 18 vs 6): new `getPublicDecimals`/`getConfidentialDecimals`/`getPublicSymbol` accessors and `scaleAmount`/`quantizeAmount` helpers; transaction store entries now record the denomination of their amounts; shield inputs are quantized to the precision the contract actually mints; unshield amounts are guarded against the confidential value type's range.
