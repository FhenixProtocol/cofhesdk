# TL;DR — batch signature endpoint

A **new** endpoint `POST /verify-batch` returns **one signature for the whole batch**.
The existing `POST /verify` endpoint is **unchanged** (one signature per ciphertext) and stays
fully backward compatible — existing SDK clients need no changes.

|                 | `POST /verify` (legacy, unchanged)         | `POST /verify-batch` (new)                   |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| Signatures      | **one per ciphertext**                     | **one for the whole batch**                  |
| `data` shape    | **array** of `{ct_hash, signature, recid}` | **object**: `{outputs[], signature, recid}`  |
| Per-item fields | `ct_hash`, `signature`, `recid`            | `outputs[]` carry `ct_hash` + `ct_type` only |

The request body is **identical** for both endpoints:

```json
{
  "packed_list": "<hex>",
  "account_addr": "0x…",
  "security_zone": 0,
  "chain_id": 11155111
}
```

## Response shapes

### `POST /verify` — legacy (unchanged)

```json
{
  "status": "success",
  "data": [
    { "ct_hash": "0x…", "signature": "0x…(64-byte r||s)", "recid": 0 },
    { "ct_hash": "0x…", "signature": "0x…(64-byte r||s)", "recid": 1 }
  ]
}
```

Each entry's signature covers that ciphertext's own message hash:
`keccak256(ct_hash || ct_type || security_zone || account_addr || chain_id_padded)`.

### `POST /verify-batch` — new

```json
{
  "status": "success",
  "data": {
    "outputs": [
      { "ct_hash": "0x…", "ct_type": 6 },
      { "ct_hash": "0x…", "ct_type": 6 }
    ],
    "signature": "0x…(64-byte r||s)",
    "recid": 0
  }
}
```

- `outputs` is ordered — index `i` corresponds to ciphertext `i` in the submitted `packed_list`.
- `signature` is the 64-byte `r || s` (hex, `0x`-prefixed). `recid` is the recovery id (`0–3`) — append as the 65th byte if you need EVM `r||s||v` form.
- The error shape is the same for both endpoints: `{ "status": "error", "data": { "message": "…" } }`.

## What SDK devs should do

**Nothing is required** — `/verify` keeps working exactly as before. Migrate to `/verify-batch`
only if you want a single signature per request (fewer signatures to store / verify on-chain).

### To use the new batch endpoint

1. **Call `POST /verify-batch`** instead of `/verify` (same request body).

2. **Parse the new shape.** Read `data.outputs` for the per-ciphertext hashes/types, and read the
   single `data.signature` + `data.recid` once (instead of iterating an array).

3. **Reconstruct the signed digest (hash-of-hashes)** to verify/recover the signer:

   ```
   # shared across the batch (from your original request)
   chain_id_padded = chain_id as 32-byte big-endian
   account_addr    = raw address bytes (no 0x)

   # per ciphertext i (in outputs order)
   hash_i = keccak256( ct_hash_i || ct_type_i || security_zone || account_addr || chain_id_padded )
            #            32 bytes     1 byte       1 byte          ~20 bytes      32 bytes

   # batch digest
   batch  = keccak256( hash_0 || hash_1 || … || hash_n )

   # verify / recover against the single signature
   recover(batch, signature, recid) == signer_address
   ```

   `ct_hash_i` is `keccak256(ct_bytes_i)` — the same value returned in `outputs[i].ct_hash` (the
   raw, non-metadata-adjusted hash, which is what gets signed). `security_zone`, `account_addr`,
   and `chain_id` come from the request you sent — they are not echoed in `outputs`.

### Key points / gotchas (batch endpoint only)

- **Order matters.** `hash_i` must be concatenated in the exact `outputs` order. A different order
  produces a different — invalid — digest.
- **`ct_type` is needed for verification** and is provided per output; the legacy endpoint did not
  return it.
- The per-ciphertext binding (`ct_hash`, `ct_type`, `security_zone`, `account_addr`, `chain_id`) is
  identical to the legacy endpoint — only the final fold into one signature is new. So `hash_i` for
  `/verify-batch` is exactly the message the legacy `/verify` signs per ciphertext.
- One signature covers the whole batch: it verifies all-or-nothing. You can't validate a single
  ciphertext's inclusion without the full ordered `outputs` set.
