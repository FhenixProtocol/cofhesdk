---
'@cofhe/sdk': patch
---

Corrects the `ctx.op` that `setCofheDebugInterceptors` handlers receive to name each request: `decrypt`, `decrypt-poll`, `sealoutput` or `sealoutput-poll`. Previously every request reported `request`, so an interceptor could not tell a decrypt from a sealoutput or a submit from a poll.
