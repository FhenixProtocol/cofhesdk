#!/usr/bin/env node

/**
 * Ensure test contracts are deployed on all target chains.
 *
 * Uses `forge` to compile and deploy, `cast` to check on-chain state.
 * Reads/writes deployments.json as the registry.
 *
 * Usage:
 *   node setup.mjs                          # all enabled chains
 *   node setup.mjs --chains 84532,421614    # specific chains
 *   node setup.mjs --dry-run                # preview only
 *
 * Env:
 *   TEST_PRIVATE_KEY            — deployer key for testnets (required, loaded from root .env)
 *   TEST_LOCALCOFHE_ENABLED     — set to "true" to include localcofhe
 *   TEST_LOCALCOFHE_PRIVATE_KEY — deployer key for localcofhe (required when localcofhe enabled)
 *   LOCALCOFHE_HOST_CHAIN_RPC   — localcofhe RPC (default: http://127.0.0.1:42069)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, 'deployments.json');

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

const localcofheEnabled = process.env.TEST_LOCALCOFHE_ENABLED === 'true';

// Build the full chain list
const ALL_CHAINS = [...TESTNET_CHAINS];
if (localcofheEnabled) {
  ALL_CHAINS.push(LOCALCOFHE_CHAIN);
}

const privateKey = process.env.TEST_PRIVATE_KEY;
if (!privateKey) { console.error('TEST_PRIVATE_KEY is required'); process.exit(1); }

if (localcofheEnabled && !process.env.TEST_LOCALCOFHE_PRIVATE_KEY) {
  console.error('TEST_LOCALCOFHE_PRIVATE_KEY is required when TEST_LOCALCOFHE_ENABLED=true');
  process.exit(1);
}

const deployer = run(`cast wallet address $TEST_PRIVATE_KEY`);
console.log(`Deployer: ${deployer}`);
if (localcofheEnabled) {
  const localDeployer = run(`cast wallet address $TEST_LOCALCOFHE_PRIVATE_KEY`);
  console.log(`Localcofhe deployer: ${localDeployer}`);
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
