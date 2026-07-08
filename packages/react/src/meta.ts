// Metadata attached to Cofhe read/decrypt react-query queries so observers (debug
// panels, a future decryption-activity hook) can recognize the contract, method,
// value label, and 2-stage linkage without parsing query keys or maintaining side
// registries. See docs/decryption-metadata-and-lifecycle.md.

/**
 * Consumer-facing metadata — the only metadata type an app author constructs.
 * Fully generic (not token-specific) and optional everywhere.
 */
export interface CofheDecryptMeta {
  /**
   * Human label for this value in debug/activity views: a token symbol,
   * "Vault balance", "Bid #42", "Round 7 tally" — anything.
   */
  label?: string;
  /** Any extra fields the consumer wants carried onto the card. */
  [key: string]: unknown;
}

/**
 * Internal metadata the SDK attaches to a query's react-query `meta`, read by
 * observers. Consumers never construct this — the SDK fills the structural fields
 * and namespaces consumer metadata under `consumer`.
 */
export interface CofheQueryMeta {
  /** Which pipeline stage this query is. */
  kind: 'cofheRead' | 'cofheDecrypt';
  chainId?: number;
  /** Contract address (method context). */
  address?: string;
  /** Function name (method). */
  functionName?: string;
  /** ctHash, on the decrypt stage. */
  ctHash?: string;
  /**
   * Optional SDK-managed correlation between a read and its decrypt. Usually
   * unnecessary — the read returns the ctHash that becomes the decrypt's key, so
   * ctHash already links the stages. Reserved for fan-out cases.
   */
  correlationId?: string;
  /** Consumer-supplied metadata. */
  consumer?: CofheDecryptMeta;
}
