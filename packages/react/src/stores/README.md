# Consuming CoFHE Transactions

The React package keeps a persisted transaction store for Activity, token history, status toasts, and receipt tracking. Consumers should add transactions through the public transaction helpers instead of mutating the store directly.

Use this when your app submits a transaction that should appear alongside built-in CoFHE actions such as shield, unshield, claim, approve, or shielded transfer.

## Add a transaction from React

```tsx
import { useCofheTransactions } from '@cofhe/react';

function VerifyKycButton({
  account,
  chainId,
  verifierAddress,
}: {
  account: `0x${string}`;
  chainId: number;
  verifierAddress: `0x${string}`;
}) {
  const { addTransaction } = useCofheTransactions();

  async function submitVerification() {
    const hash = await submitKycVerification();

    addTransaction({
      hash,
      chainId,
      account,
      actionType: 'custom-kyc-verification',
      title: 'KYC verification',
      description: 'Verification submitted on chain',
      payload: {
        verifierAddress,
      },
    });
  }

  return <button onClick={submitVerification}>Verify</button>;
}
```

New transactions are stored as `pending` with the current timestamp. While `CofheProvider` is mounted, the SDK watches pending transaction receipts and updates each transaction to `confirmed` or `failed`.

## Add a transaction outside React render flow

```ts
import { addCofheTransaction } from '@cofhe/react';

addCofheTransaction({
  hash,
  chainId,
  account,
  actionType: 'custom-kyc-verification',
  title: 'KYC verification',
  description: 'Verification submitted on chain',
  payload: {
    verifierAddress,
  },
});
```

This is useful in action helpers, callbacks, or framework code where a React hook is not available.

## Custom transaction shape

Custom transactions use the `custom-${string}` action type namespace:

```ts
addTransaction({
  hash: '0x...',
  chainId: 84532,
  account: '0x...',
  actionType: 'custom-auction-settlement',
  title: 'Auction settlement',
  description: 'Final settlement transaction submitted',
  tokenTags: ['0x...'],
  payload: {
    auctionId: '42',
    lotId: '7',
  },
});
```

The important fields are:

- `hash`: transaction hash.
- `chainId`: chain where the transaction was submitted.
- `account`: account that submitted the transaction.
- `actionType`: built-in action type or a custom value prefixed with `custom-`.
- `title`: optional display title. If omitted, the SDK falls back to the action type.
- `description`: optional display text for the fallback transaction row.
- `tokenTags`: optional token addresses that make the transaction appear in token-specific history.
- `payload`: optional JSON-serializable metadata for your renderer or the fallback JSON display.

Keep `payload` serializable. The transaction store is persisted, so do not put React nodes, functions, class instances, or non-JSON objects in it.

## Token history

Built-in token transactions are automatically tagged with their token address. Custom transactions can opt into token history by passing `tokenTags`.

```ts
addTransaction({
  hash,
  chainId,
  account,
  actionType: 'custom-token-rebalance',
  title: 'Token rebalance',
  tokenTags: [tokenAddress],
  payload: {
    rebalanceId,
  },
});
```

The SDK normalizes `tokenTags` for matching. Token-specific views include transactions when either the built-in token field matches or a token tag matches.

## Custom renderers

If you want a custom Activity row, register a renderer on `CofheProvider`. The renderer key is the transaction `actionType`.

```tsx
import { CofheProvider, type TransactionRendererProps, type Transaction } from '@cofhe/react';

type KycTransaction = Transaction & {
  actionType: 'custom-kyc-verification';
  payload?: {
    verifierAddress?: string;
  };
};

function KycTransactionItem({ transaction }: TransactionRendererProps<KycTransaction>) {
  return (
    <div>
      <strong>{transaction.title ?? 'KYC verification'}</strong>
      <span>{transaction.status}</span>
      <code>{transaction.payload?.verifierAddress}</code>
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CofheProvider
      transactionRenderers={{
        'custom-kyc-verification': KycTransactionItem,
      }}
    >
      {children}
    </CofheProvider>
  );
}
```

If no renderer is registered for a custom action type, the SDK still renders the transaction with its title, status, timestamp, hash link, optional description, and JSON-formatted payload.

## Reading transactions

`useCofheTransactions()` returns the current transaction map plus helper methods:

```ts
const { transactions, getTransaction, getAllTransactions, getAllTransactionsByToken, clearTransactions } =
  useCofheTransactions();
```

Prefer these helpers for app code. `useTransactionStore` is exported for low-level integrations and SDK internals, but most consumers should not need it.

## Cache invalidation

The SDK handles CoFHE token cache invalidation for built-in transaction action types. For custom transaction action types, the SDK invalidates the submitting account's native token balance because every transaction spends gas. App-specific query invalidation remains the consumer's responsibility.
