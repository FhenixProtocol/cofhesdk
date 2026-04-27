#!/usr/bin/env node

/**
 * @cofhe/test-setup — deploy contracts, initialize on-chain state, build.
 *
 * Phases:
 *   1. Deploy    — forge build → forge create per chain. Skips if bytecodeHash matches.
 *   2. Init      — Store pre-encrypted values on PRIMARY_TEST_CHAIN for core SDK tests.
 *   3. Build     — pnpm build (tsup) to bake registries into dist/.
 *
 * Usage:
 *   node setup.mjs                          # all enabled chains
 *   node setup.mjs --chains 84532,421614    # specific chains
 *   node setup.mjs --dry-run                # preview only
 *
 * Env (loaded from root .env):
 *   TEST_PRIVATE_KEY, PRIMARY_TEST_CHAIN,
 *   TEST_LOCALCOFHE_PRIVATE_KEY, LOCALCOFHE_HOST_CHAIN_RPC
 *
 * Requires: forge, cast (Foundry)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, 'src/deployments.json');
const PRIMARY_REGISTRY_PATH = resolve(__dirname, 'src/primaryTestChainRegistry.json');

// ── .env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

// ── Chains ──────────────────────────────────────────────────────────────────

const TESTNET_CHAINS = [
  { id: 11155111, label: 'Ethereum Sepolia', rpcEnv: 'SEPOLIA_RPC_URL', rpc: 'https://ethereum-sepolia.publicnode.com' },
  { id: 84532, label: 'Base Sepolia', rpcEnv: 'BASE_SEPOLIA_RPC_URL', rpc: 'https://sepolia.base.org' },
  { id: 421614, label: 'Arbitrum Sepolia', rpcEnv: 'ARBITRUM_SEPOLIA_RPC_URL', rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
];

const LOCALCOFHE_CHAIN = {
  id: 420105,
  label: 'Local Cofhe',
  rpcEnv: 'LOCALCOFHE_HOST_CHAIN_RPC',
  rpc: 'http://127.0.0.1:42069',
  privateKeyEnv: 'TEST_LOCALCOFHE_PRIVATE_KEY',
};

const CONTRACTS = ['SimpleTest'];

// ── Helpers ─────────────────────────────────────────────────────────────────

const run = (cmd) => execSync(cmd, { cwd: __dirname, encoding: 'utf8' }).trim();

function readRegistry() {
  try { return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')); } catch { return {}; }
}

function writeRegistry(reg) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + '\n');
}

function bytecodeHash(contractName) {
  const artifact = JSON.parse(
    readFileSync(resolve(__dirname, `out/${contractName}.sol/${contractName}.json`), 'utf8')
  );
  return '0x' + createHash('sha256').update(artifact.bytecode.object).digest('hex');
}

function hasCodeOnChain(rpc, address) {
  try {
    const code = run(`cast code ${address} --rpc-url ${rpc}`);
    return code !== '0x' && code.length > 2;
  } catch { return false; }
}

function deploy(rpc, privateKeyEnvName, contractName) {
  const out = run(
    `forge create contracts/${contractName}.sol:${contractName} --rpc-url ${rpc} --private-key $${privateKeyEnvName} --broadcast`
  );
  const addressMatch = out.match(/Deployed to:\s*(0x[0-9a-fA-F]+)/);
  const txMatch = out.match(/Transaction hash:\s*(0x[0-9a-fA-F]+)/);
  if (!addressMatch) throw new Error(`Could not parse deployed address from forge output:\n${out}`);
  return { address: addressMatch[1], txHash: txMatch?.[1] };
}

function getBalance(rpc, address) {
  return run(`cast balance ${address} --rpc-url ${rpc}`);
}

function getPrivateKeyEnvName(chain) {
  return chain.privateKeyEnv || 'TEST_PRIVATE_KEY';
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = { chains: null, dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--chains') args.chains = argv[++i].split(',').map(Number);
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node setup.mjs [--chains <ids>] [--dry-run]');
      process.exit(0);
    }
  }
  return args;
}

// ── Main ────────────────────────────────────────────────────────────────────

loadEnv();
const args = parseArgs();

const ALL_CHAINS = [...TESTNET_CHAINS, LOCALCOFHE_CHAIN];

const privateKey = process.env.TEST_PRIVATE_KEY;
if (!privateKey) { console.error('TEST_PRIVATE_KEY is required'); process.exit(1); }

const deployer = run(`cast wallet address $TEST_PRIVATE_KEY`);

// ── Funding report ──────────────────────────────────────────────────────────

const bold = (s) => `\x1b[1m${s}\x1b[22m`;
const green = (s) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s) => `\x1b[33m${s}\x1b[39m`;
const red = (s) => `\x1b[31m${s}\x1b[39m`;

function colorBalance(ethStr) {
  const eth = parseFloat(ethStr);
  const formatted = bold(ethStr);
  if (eth >= 1) return green(formatted);
  if (eth >= 0.1) return yellow(formatted);
  return red(formatted);
}

function getBalanceEther(rpc, address) {
  try {
    return run(`cast balance ${address} --ether --rpc-url ${rpc}`);
  } catch {
    return '?';
  }
}

const MIN_BALANCE_ETH = 0.1;
const underfunded = [];

console.log(`\nAccount ${bold(deployer)} funding:`);
for (const chain of ALL_CHAINS) {
  const rpc = process.env[chain.rpcEnv] || chain.rpc;
  const pkEnvName = getPrivateKeyEnvName(chain);
  if (pkEnvName !== 'TEST_PRIVATE_KEY' && !process.env[pkEnvName]) {
    console.log(`  ${chain.label}: skip — ${pkEnvName} not set`);
    continue;
  }
  const addr = pkEnvName === 'TEST_PRIVATE_KEY' ? deployer : run(`cast wallet address $${pkEnvName}`);
  const bal = getBalanceEther(rpc, addr);
  console.log(`  ${chain.label}: ${colorBalance(bal)} ETH`);
  const parsed = parseFloat(bal);
  if (!isNaN(parsed) && parsed < MIN_BALANCE_ETH) {
    underfunded.push({ label: chain.label, address: addr, balance: bal });
  }
}

if (underfunded.length) {
  console.error(`\n${red(bold('ERROR:'))} The following chains have less than ${MIN_BALANCE_ETH} ETH:`);
  for (const { label, address, balance } of underfunded) {
    console.error(`  ${label}: ${address} has ${balance} ETH`);
  }
  process.exit(1);
}

// Compile
console.log('\nCompiling...');
run('forge build');

const registry = readRegistry();
let changed = false;

const targets = args.chains
  ? args.chains.map((id) => ALL_CHAINS.find((c) => c.id === id) || (() => { throw new Error(`Unknown chain ${id}`); })())
  : ALL_CHAINS;

for (const contract of CONTRACTS) {
  const hash = bytecodeHash(contract);
  console.log(`\n${contract}  bytecodeHash: ${hash.slice(0, 18)}...`);

  if (!registry[contract]) registry[contract] = {};

  for (const chain of targets) {
    const rpc = process.env[chain.rpcEnv] || chain.rpc;
    const pkEnvName = getPrivateKeyEnvName(chain);
    const pkValue = process.env[pkEnvName];
    const key = String(chain.id);
    const entry = registry[contract][key];
    let action, reason;

    if (!pkValue) {
      console.log(`  ${chain.label} (${chain.id}): skip — ${pkEnvName} not set`);
      continue;
    }

    if (!entry?.address) {
      action = 'deploy'; reason = 'no registry entry';
    } else if (entry.bytecodeHash === hash && hasCodeOnChain(rpc, entry.address)) {
      action = 'skip'; reason = 'up to date';
    } else if (!entry.bytecodeHash && hasCodeOnChain(rpc, entry.address)) {
      action = 'record'; reason = 'recording bytecodeHash for existing deployment';
    } else {
      action = 'deploy';
      reason = entry.bytecodeHash !== hash ? 'bytecodeHash changed' : 'no code on-chain';
    }

    console.log(`  ${chain.label} (${chain.id}): ${action} — ${reason}`);

    if (action === 'skip') continue;

    if (action === 'record') {
      registry[contract][key] = { ...entry, bytecodeHash: hash, deployedAt: entry.deployedAt || new Date().toISOString() };
      changed = true;
      continue;
    }

    if (args.dryRun) { console.log('    [dry-run] would deploy'); continue; }

    const chainDeployer = run(`cast wallet address $${pkEnvName}`);
    const bal = getBalance(rpc, chainDeployer);
    if (bal === '0') { console.error(`    Deployer ${chainDeployer} has 0 balance on ${chain.label}, skipping`); continue; }

    try {
      const result = deploy(rpc, pkEnvName, contract);
      console.log(`    Deployed: ${result.address}  tx: ${result.txHash}`);
      registry[contract][key] = { address: result.address, bytecodeHash: hash, deployedAt: new Date().toISOString() };
      changed = true;
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
    }
  }
}

if (changed) {
  writeRegistry(registry);
  console.log(`\nRegistry updated: ${REGISTRY_PATH}`);
} else {
  console.log('\nAll deployments up to date.');
}

// ── Primary test chain initialization ───────────────────────────────────────

const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');

const PRIVATE_VALUE = 42;
const PUBLIC_VALUE = 7;
const ADD_VALUE = 50;

function readPrimaryRegistry() {
  try { return JSON.parse(readFileSync(PRIMARY_REGISTRY_PATH, 'utf8')); } catch { return {}; }
}

function writePrimaryRegistry(reg) {
  writeFileSync(PRIMARY_REGISTRY_PATH, JSON.stringify(reg, null, 2) + '\n');
}

function castSend(rpc, pkEnvName, to, sig, ...callArgs) {
  const argsStr = callArgs.length ? ' ' + callArgs.join(' ') : '';
  run(`cast send ${to} "${sig}"${argsStr} --rpc-url ${rpc} --private-key $${pkEnvName}`);
}

function castCall(rpc, to, sig) {
  return run(`cast call ${to} "${sig}" --rpc-url ${rpc}`);
}

function initializePrimaryChain() {
  const primaryChain = ALL_CHAINS.find(c => c.id === PRIMARY_TEST_CHAIN);
  if (!primaryChain) {
    console.log(`\nPrimary test chain ${PRIMARY_TEST_CHAIN}: not in chain list, skipping initialization`);
    return;
  }

  const contractAddress = registry['SimpleTest']?.[String(PRIMARY_TEST_CHAIN)]?.address;
  if (!contractAddress) {
    console.log(`\nPrimary test chain ${PRIMARY_TEST_CHAIN}: no SimpleTest deployment, skipping initialization`);
    return;
  }

  const primaryReg = readPrimaryRegistry();
  const deployedAt = registry['SimpleTest'][String(PRIMARY_TEST_CHAIN)].deployedAt;
  const needsInit = !primaryReg.chainId
    || primaryReg.contractAddress !== contractAddress
    || primaryReg.deploymentTimestamp !== deployedAt;

  if (!needsInit) {
    console.log(`\nPrimary test chain ${PRIMARY_TEST_CHAIN}: values already initialized`);
    return;
  }

  if (args.dryRun) {
    console.log(`\nPrimary test chain ${PRIMARY_TEST_CHAIN}: [dry-run] would initialize values`);
    return;
  }

  const rpc = process.env[primaryChain.rpcEnv] || primaryChain.rpc;
  const pkEnvName = getPrivateKeyEnvName(primaryChain);

  console.log(`\nInitializing primary test chain values on ${primaryChain.label} (${PRIMARY_TEST_CHAIN})...`);

  // 1. Store private value via setValueTrivial
  console.log(`  setValueTrivial(${PRIVATE_VALUE})...`);
  castSend(rpc, pkEnvName, contractAddress, 'setValueTrivial(uint256)', String(PRIVATE_VALUE));
  const privateCtHash = castCall(rpc, contractAddress, 'getValueHash()');
  const privateHandle = castCall(rpc, contractAddress, 'getValue()');
  console.log(`    ctHash: ${privateCtHash}`);

  // 2. Store public value via setPublicValueTrivial
  console.log(`  setPublicValueTrivial(${PUBLIC_VALUE})...`);
  castSend(rpc, pkEnvName, contractAddress, 'setPublicValueTrivial(uint256)', String(PUBLIC_VALUE));
  const publicCtHash = castCall(rpc, contractAddress, 'publicValueHash()');
  const publicHandle = castCall(rpc, contractAddress, 'publicValue()');
  console.log(`    ctHash: ${publicCtHash}`);

  // 3. Add value via addValueTrivial (adds to storedValue which is currently PRIVATE_VALUE)
  console.log(`  addValueTrivial(${ADD_VALUE})...`);
  castSend(rpc, pkEnvName, contractAddress, 'addValueTrivial(uint256)', String(ADD_VALUE));
  const addedCtHash = castCall(rpc, contractAddress, 'getValueHash()');
  const addedHandle = castCall(rpc, contractAddress, 'getValue()');
  console.log(`    ctHash: ${addedCtHash}  (expected sum: ${PRIVATE_VALUE + ADD_VALUE})`);

  const newPrimaryReg = {
    chainId: PRIMARY_TEST_CHAIN,
    contractAddress,
    deploymentTimestamp: deployedAt,
    privateValue: { value: PRIVATE_VALUE, ctHash: privateCtHash, handle: privateHandle },
    publicValue: { value: PUBLIC_VALUE, ctHash: publicCtHash, handle: publicHandle },
    addedValue: {
      value: PRIVATE_VALUE + ADD_VALUE,
      addend: ADD_VALUE,
      expectedSum: PRIVATE_VALUE + ADD_VALUE,
      ctHash: addedCtHash,
      handle: addedHandle,
    },
    initializedAt: new Date().toISOString(),
  };

  writePrimaryRegistry(newPrimaryReg);
  console.log(`  Primary test chain registry updated: ${PRIMARY_REGISTRY_PATH}`);
}

initializePrimaryChain();

// ── Build ───────────────────────────────────────────────────────────────────

console.log('\nBuilding @cofhe/test-setup...');
run('pnpm build');
console.log('Build complete.');
