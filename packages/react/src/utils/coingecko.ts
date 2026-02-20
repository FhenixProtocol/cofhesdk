import type { Address } from 'viem';
import { ETH_ADDRESS } from '@/types/token';

export const DEFAULT_COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3' as const;

// CoinGecko "platform" ids used by /simple/token_price/{platform}
export const COINGECKO_PLATFORM_BY_CHAIN_ID: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  100: 'xdai',
  137: 'polygon-pos',
  250: 'fantom',
  42161: 'arbitrum-one',
  43114: 'avalanche',
  8453: 'base',
} as const;

// CoinGecko "coin" ids used by /simple/price?ids=...
// Note: Many EVM chains share native ETH pricing (L2s etc.), but we keep a minimal mapping.
export const COINGECKO_NATIVE_COIN_ID_BY_CHAIN_ID: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'ethereum',
  42161: 'ethereum',
  8453: 'ethereum',
  100: 'xdai',
  137: 'matic-network',
  56: 'binancecoin',
  43114: 'avalanche-2',
  250: 'fantom',
} as const;

export function normalizeCoingeckoContractAddress(address: Address): string {
  return address.toLowerCase();
}

export function getCoingeckoPlatformId(chainId: number | undefined): string | undefined {
  if (!chainId) return undefined;
  return COINGECKO_PLATFORM_BY_CHAIN_ID[chainId];
}

export function getCoingeckoNativeCoinId(chainId: number | undefined): string | undefined {
  if (!chainId) return undefined;
  return COINGECKO_NATIVE_COIN_ID_BY_CHAIN_ID[chainId];
}

export function buildCoingeckoSimpleTokenPriceUrl({
  apiBaseUrl = DEFAULT_COINGECKO_API_BASE_URL,
  platformId,
  contractAddress,
}: {
  apiBaseUrl?: string;
  platformId: string;
  contractAddress: Address;
}): string {
  const contract = normalizeCoingeckoContractAddress(contractAddress);
  const url = new URL(`${apiBaseUrl.replace(/\/$/, '')}/simple/token_price/${platformId}`);
  url.searchParams.set('contract_addresses', contract);
  url.searchParams.set('vs_currencies', 'usd');
  return url.toString();
}

export function buildCoingeckoSimplePriceUrl({
  apiBaseUrl = DEFAULT_COINGECKO_API_BASE_URL,
  coinId,
}: {
  apiBaseUrl?: string;
  coinId: string;
}): string {
  const url = new URL(`${apiBaseUrl.replace(/\/$/, '')}/simple/price`);
  url.searchParams.set('ids', coinId);
  url.searchParams.set('vs_currencies', 'usd');
  return url.toString();
}

export function parseCoingeckoSimpleTokenPriceUsd({
  responseJson,
  contractAddress,
}: {
  responseJson: unknown;
  contractAddress: Address;
}): number | null {
  const key = normalizeCoingeckoContractAddress(contractAddress);
  const obj = responseJson as Record<string, any>;
  const usd = obj?.[key]?.usd;
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return null;
  return usd;
}

export function parseCoingeckoSimplePriceUsd({
  responseJson,
  coinId,
}: {
  responseJson: unknown;
  coinId: string;
}): number | null {
  const obj = responseJson as Record<string, any>;
  const usd = obj?.[coinId]?.usd;
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return null;
  return usd;
}

export function isNativeTokenAddress(address: Address | undefined): boolean {
  if (!address) return false;
  return address.toLowerCase() === ETH_ADDRESS.toLowerCase();
}

export const TMP_WBTC_ON_MAINNET = {
  chainId: 1,
  address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
} as const;
