import errorsJson from '@fhenixprotocol/cofhe-errors/errors.json';

export type CofheSolidityError = {
  name: string;
  selector: `0x${string}`;
  signature: string;
  source: string;
  inputs: string[];
  inputTypes: string[];
};

const errors = errorsJson as unknown as readonly CofheSolidityError[];

function normalizeSelector(selector: string): `0x${string}` | undefined {
  if (typeof selector !== 'string') return undefined;
  const s = selector.trim().toLowerCase();
  if (!s.startsWith('0x')) return undefined;
  // Solidity custom error selector is 4 bytes => 10 chars including 0x prefix.
  if (s.length < 10) return undefined;
  return s.slice(0, 10) as `0x${string}`;
}

export function decodeCofheErrorSelector(selectorOrRevertData: string): CofheSolidityError | undefined {
  const selector = normalizeSelector(selectorOrRevertData);
  if (!selector) return undefined;
  return errors.find((e) => e.selector.toLowerCase() === selector);
}

export function cofheHumanizeRevertReason(reasonOfRevert: string): string | undefined {
  const decoded = decodeCofheErrorSelector(reasonOfRevert);
  if (!decoded) return undefined;

  // Keep it compact for UI toasts, but still useful.
  // Example: "OwnableUnauthorizedAccount(address) (Ownable2StepUpgradeable)"
  return `${decoded.signature} (${decoded.source})`;
}
