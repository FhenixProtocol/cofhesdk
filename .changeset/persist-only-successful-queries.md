---
'@cofhe/react': patch
---

fix(react): persist only successful query states

The persistence filter checked only the `meta.persist` opt-in, without react-query's default status check, so a query was dehydrated in whatever state it was in — including `error`. A restored errored query never refetches (persisted queries default to `staleTime: Infinity` / `refetchOnMount: false`), leaving the consumer stuck with a permanent failed state that survives reloads and emits no error event on hydration.

Only successful states are persisted now. Once a query errors, its entry (including any previously persisted success) is dropped from the snapshot, so the next load starts clean and fetches live.
