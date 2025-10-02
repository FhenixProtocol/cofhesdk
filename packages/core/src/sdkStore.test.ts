import { describe, it, expect, beforeEach } from 'vitest';
import { sdkStore } from './sdkStore';
import { CofhesdkConfig, createCofhesdkConfig } from './config';
import { sepolia as cofhesdk_sepolia } from '@cofhesdk/chains';
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { sepolia as viem_sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

describe('sdkStore', () => {
  let config: CofhesdkConfig;
  let publicClient: PublicClient;
  let walletClient: WalletClient;

  beforeEach(() => {
    // Clear store before each test
    sdkStore.clearSdkStore();

    // Setup
    config = createCofhesdkConfig({
      supportedChains: [cofhesdk_sepolia],
    });
    publicClient = createPublicClient({
      chain: viem_sepolia,
      transport: http(),
    });
    walletClient = createWalletClient({
      chain: viem_sepolia,
      transport: http(),
      account: privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
    });
  });

  it('should initialize with null values', () => {
    expect(sdkStore.getConfig()).toBeNull();
    expect(sdkStore.getPublicClient()).toBeNull();
    expect(sdkStore.getWalletClient()).toBeNull();
  });

  it('should set and get config', () => {
    sdkStore.setConfig(config);
    expect(sdkStore.getConfig()).toEqual(config);
  });

  it('should set and get public client', () => {
    sdkStore.setPublicClient(publicClient);
    expect(sdkStore.getPublicClient()).toEqual(publicClient);
  });

  it('should set and get wallet client', () => {
    sdkStore.setWalletClient(walletClient);
    expect(sdkStore.getWalletClient()).toEqual(walletClient);
  });

  it('should clear all values', () => {
    sdkStore.setConfig(config);
    sdkStore.setPublicClient(publicClient);
    sdkStore.setWalletClient(walletClient);

    expect(sdkStore.getConfig()).toEqual(config);
    expect(sdkStore.getPublicClient()).toEqual(publicClient);
    expect(sdkStore.getWalletClient()).toEqual(walletClient);

    sdkStore.clearSdkStore();

    expect(sdkStore.getConfig()).toBeNull();
    expect(sdkStore.getPublicClient()).toBeNull();
    expect(sdkStore.getWalletClient()).toBeNull();
  });
});
