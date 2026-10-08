---
'@cofhe/react': minor
---

`useCofheShareLabels(share, { verify, abis })` describes the labels of a share (read from the registry, or an imported ACP) at once and fills in each one's check as the chain answers. `useCofheShareOnChain` takes `{ acp, labels }` (or `{ acp, metadata }`) besides a bare ACP. The floating button inbox lists each share's labels with their checks.
