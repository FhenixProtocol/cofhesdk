import type { PublicClient, WalletClient, Chain, Hex } from "viem";
import { createWalletClient, custom } from "viem";


type SmartAccountClient = {
    account: { address: `0x${string}` };
    // Sends a UserOperation, returns a hash (usually userOpHash)
    // eslint-disable-next-line no-unused-vars
    sendTransaction: (tx: any) => Promise<`0x${string}`>;
    // EIP-712 via smart account (e.g., Safe EIP-1271)
    signTypedData: (_args: { domain: any; types: Record<string, any>; primaryType: string; message: Record<string, any> }) => Promise<`0x${string}`>;
    // Optional:
    signMessage?: (_args: { message: string | Hex }) => Promise<`0x${string}`>;
};

/**
 * Adapter: (publicClient, smartAccountClient) -> { publicClient, walletClient }
 * - publicClient: passthrough of the given viem PublicClient
 * - walletClient: viem WalletClient-shaped object whose sendTransaction/sign* delegate to the smart account
 */
export function smartWalletViemAdapter(publicClient: PublicClient, smartAccountClient: SmartAccountClient, opts: { chain?: Chain } = {}): { publicClient: PublicClient; walletClient: WalletClient } {
    const chain = opts.chain ?? (publicClient as any).chain;

    // Use the existing publicClient for all JSON-RPC calls
    const transport = custom({
        request: ({ method, params }: { method: string; params?: any[] }) => publicClient.request({ method: method as any, params: (params ?? []) as any }),
    });

    // Create a base viem WalletClient (JSON-RPC account placeholder)
    // We’ll override methods to route through the smart account.
    const base = createWalletClient({
        chain,
        transport,
        account: smartAccountClient.account.address, // not used for signing; just keeps API shape
    });

    // Override methods that must go through the smart account
    const walletClient: WalletClient = {
        ...base,

        /**
         * For AA, this sends a UserOperation via your smartAccountClient.
         * Return value is typically a userOp hash (not a raw tx hash).
         */
        async sendTransaction(tx: any) {
            return smartAccountClient.sendTransaction(tx);
        },

        /**
         * Sign typed data via the smart account (EIP-1271 flow).
         * Supports both single-object and (domain, types, message) forms.
         */
        async signTypedData(arg1: any, types?: any, message?: any) {
            let domain, typesObj, messageObj, primaryType: string;
            if (types === undefined && message === undefined) {
                // Single object: { domain, types, message, primaryType }
                domain = arg1.domain;
                typesObj = arg1.types;
                messageObj = arg1.message;
                primaryType = arg1.primaryType;
            } else {
                // Separate params
                domain = arg1;
                typesObj = types;
                messageObj = message;
                primaryType = Object.keys(typesObj).find((k) => k !== "EIP712Domain") ?? Object.keys(typesObj)[0];
            }
            return smartAccountClient.signTypedData({ domain, types: typesObj, primaryType, message: messageObj });
        },

        /**
         * Optional message signing if your smart account client supports it.
         * Otherwise, fall back to base (may throw for smart accounts).
         */
        async signMessage(args: { message: string | Hex }) {
            if (typeof smartAccountClient.signMessage === "function") {
                return smartAccountClient.signMessage(args);
            }
            // Fallback to base signMessage if smart account doesn't support it
            return base.signMessage({...args, account: base.account });
        },

        /**
         * Smart accounts generally cannot produce a raw signed EOA tx.
         * Keep viem’s default, but expect it to throw if invoked.
         */
        // signTransaction: base.signTransaction,
    } as WalletClient;

    return { publicClient, walletClient };
}
