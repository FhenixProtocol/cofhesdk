import errorsJson from '@fhenixprotocol/cofhe-errors/errors.json';
import { ContractFunctionExecutionError, ContractFunctionRevertedError } from 'viem';

export type CofheSolidityError = {
  name: string;
  selector: `0x${string}`;
  signature: string;
  source: string;
  inputs: string[];
  inputTypes: string[];
};

function is0xString(value: string): value is `0x${string}` {
  return value.startsWith('0x');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isCofheSolidityError(value: unknown): value is CofheSolidityError {
  if (typeof value !== 'object' || value === null) return false;
  if (!('name' in value) || typeof value.name !== 'string') return false;
  if (!('selector' in value) || typeof value.selector !== 'string') return false;
  if (!is0xString(value.selector)) return false;
  if (!('signature' in value) || typeof value.signature !== 'string') return false;
  if (!('source' in value) || typeof value.source !== 'string') return false;
  if (!('inputs' in value) || !isStringArray(value.inputs)) return false;
  if (!('inputTypes' in value) || !isStringArray(value.inputTypes)) return false;
  return true;
}

function parseCofheSolidityErrors(value: unknown): readonly CofheSolidityError[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCofheSolidityError);
}

const errorsJsonUnknown: unknown = errorsJson;
const errors = parseCofheSolidityErrors(errorsJsonUnknown);

function normalizeSelector(selector: string): `0x${string}` | undefined {
  if (typeof selector !== 'string') return undefined;
  const s = selector.trim().toLowerCase();
  if (!s.startsWith('0x')) return undefined;
  // Solidity custom error selector is 4 bytes => 10 chars including 0x prefix.
  if (s.length < 10) return undefined;
  const candidate = s.slice(0, 10);
  if (!is0xString(candidate)) return undefined;
  return candidate;
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

function extractSelectorFromMessage(message: string): string | undefined {
  // Common viem patterns:
  // - "execution reverted: 0x118cdaa7"
  // - "... reverted with the following signature: 0xd8aba367 ..."
  const match = message.match(/0x[0-9a-fA-F]{8}/);
  return match?.[0];
}

export function cofheHumanizeViemError(error: unknown): string | undefined {
  if (error instanceof ContractFunctionExecutionError) {
    if (error.cause instanceof ContractFunctionRevertedError) {
      const raw = error.cause.raw;
      if (typeof raw === 'string') {
        return cofheHumanizeRevertReason(raw);
      }
    }
  }

  if (error instanceof Error) {
    const selector = extractSelectorFromMessage(error.message);
    if (selector) return cofheHumanizeRevertReason(selector);
  }

  return undefined;
}
