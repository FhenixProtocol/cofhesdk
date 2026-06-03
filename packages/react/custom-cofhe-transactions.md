# Custom CoFHE Transactions

## Goal

Expose a public SDK API that lets consumers add app-specific transactions to the persisted CoFHE transaction store, so those transactions can appear in global Activity and, when relevant, token-specific history.

This should replace app-specific SDK action types such as KYC verification. KYC and similar flows should be modeled as consumer-defined custom transactions.

## Transaction Model

The SDK should keep built-in transaction action types for built-in CoFHE flows:

```ts
type BuiltInTransactionActionType =
  | 'shieldSend'
  | 'shield'
  | 'unshield'
  | 'claim'
  | 'approve';
```

Consumer-owned transactions should use a custom action type namespace:

```ts
type CustomTransactionActionType = `custom-${string}`;

type TransactionActionType =
  | BuiltInTransactionActionType
  | CustomTransactionActionType;
```

For custom transactions, `actionType` is also the renderer lookup key. For example, `custom-kyc-verification` maps to the renderer registered for `custom-kyc-verification`.

Suggested stored shape:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type StoredTransaction = {
  hash: `0x${string}`;
  chainId: number;
  account: `0x${string}`;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  receipt?: TransactionReceipt;

  actionType: TransactionActionType;
  title?: string;
  description?: string;

  tokenTags?: `0x${string}`[];
  payload?: JsonValue;
};
```

`payload` must be JSON-serializable because the transaction store is persisted.

## Public API

Consumers should not need to import or mutate the raw Zustand store directly. The React package should expose a small convenience API:

```ts
const { addTransaction } = useCofheTransactions();

addTransaction({
  hash,
  chainId,
  account,
  actionType: 'custom-kyc-verification',
  title: 'KYC Verification',
  description: 'On-chain verification submitted',
  payload: {
    verifierAddress,
    attestationTimestamp,
  },
});
```

The API should also be usable outside React render flow where needed, either through a safe store helper or an exported imperative function.

## Renderers

Built-in action types use SDK-provided renderers.

Custom action types may be rendered by consumer-registered renderers. Renderer registration should use `actionType` as the key:

```tsx
const transactionRenderers = {
  'custom-kyc-verification': KycVerificationTransactionRenderer,
};
```

Preferred placement is a React-facing provider/config layer. If renderers are React components, provider props are likely the cleanest fit:

```tsx
<CofheProvider transactionRenderers={transactionRenderers}>
  {children}
</CofheProvider>
```

If the existing `createCofheConfig({ react: ... })` path is already React-component-friendly, this can also live under React config:

```ts
createCofheConfig({
  react: {
    transactionRenderers,
  },
});
```

The implementation should choose the option that best matches the current provider/config boundaries.

Renderer props should include the full stored transaction:

```ts
type TransactionRendererProps<TPayload extends JsonValue = JsonValue> = {
  transaction: StoredTransaction & { payload?: TPayload };
};
```

## Fallback Rendering

If no renderer is registered for a custom transaction, the SDK should render normal transaction chrome:

- `title ?? actionType`
- status
- relative time
- hash/explorer link
- optional `description`
- JSON rendering of `payload`, if present

The fallback payload rendering can be simple and explicit:

```ts
JSON.stringify(transaction.payload, null, 2)
```

## Token History Filtering

Custom transactions can opt into token-specific history with:

```ts
tokenTags?: `0x${string}`[];
```

These addresses are scoped to the transaction's `chainId`.

Built-in token transactions should populate `tokenTags` automatically, so token details can use one filtering path for built-in and custom transactions.

The legacy token filtering path should be preserved for compatibility. Token history should include a transaction when either condition is true:

- the transaction has legacy token fields matching the token address
- the transaction has `tokenTags` containing the token address

This keeps existing persisted transactions visible while enabling non-token-shaped custom transactions.

## KYC Example

KYC should be app-owned, not an SDK built-in action:

```ts
addTransaction({
  hash,
  chainId,
  account,
  actionType: 'custom-kyc-verification',
  title: 'KYC Verification',
  description: 'Verification submitted on chain',
  payload: {
    verifierAddress: KYC_VERIFIER_ADDRESS,
    attestationTimestamp: payload.timestamp,
  },
});
```

The auction app can then register:

```tsx
const transactionRenderers = {
  'custom-kyc-verification': KycVerificationTransactionRenderer,
};
```

If no renderer is registered, the Activity tab still shows the transaction using the fallback renderer.

## Open Implementation Notes

- Keep transaction tracking generic: any stored transaction hash should be watched and updated to confirmed or failed.
- Keep persisted store data serializable; do not store React nodes, functions, classes, or renderer references.
- Normalize token addresses for matching, but preserve original address strings in stored data where practical.
- Avoid requiring `token` or `tokenAmount` for custom transactions.
- Existing SDK token transaction UI can continue using token-specific renderers, but shared filtering should move toward `tokenTags`.
