---
'@cofhe/abi': patch
---

Removed a leftover debug `console.log` from `transformEncryptedReturnTypes`. Any contract read whose output is an array of encrypted values printed the internal type, the array size and the raw handles to the consumer's console. It was the only `console` call in the package, and the existing `should transform encrypted array return type` test showed the line in its output.
