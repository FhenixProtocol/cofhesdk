#!/usr/bin/env node

/**
 * @cofhe/test-setup — deploy contracts, initialize on-chain state, build.
 *
 * Phases:
 *   1. Deploy    — forge build, then per chain: CREATE2 through the deterministic deployer
 *                  where it has code (skipped when the computed address already has code),
 *                  otherwise forge create (skipped when the local record's bytecodeHash
 *                  matches and the address has code). Writes deployments.local.json.
 *   2. Values    — store SimpleTest's two values on PRIMARY_TEST_CHAIN (and staging when
 *                  enabled) and pin the handles in deployments.local.json, unless the handles
 *                  pinned there are still readable by this account.
 *   3. Build     — pnpm build (tsup) to bake deployments.local.json into dist/.
 *
 * Nothing here is committed: the chain is the source of truth, this script only finds or
 * creates what the tests need and hands the addresses to the bundle of this checkout.
 *
 * Usage:
 *   node setup.mjs                          # all enabled chains
 *   node setup.mjs --chains 84532,421614    # specific chains
 *   node setup.mjs --dry-run                # preview only
 *
 * Env (loaded from root .env):
 *   TEST_PRIVATE_KEY, PRIMARY_TEST_CHAIN,
 *   TEST_LOCALCOFHE_PRIVATE_KEY, LOCALCOFHE_HOST_CHAIN_RPC,
 *   TEST_STAGING_ENABLED (set to "true" to include CoFHE Staging)
 *   STAGING_RPC_URL (override the staging host chain RPC)
 *   STAGING_FUNDER_KEY (auto-tops-up the staging deployer with 1 ETH if it drops below 0.1 ETH)
 *
 * Requires: forge, cast (Foundry)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { CREATE2_DEPLOYER, create2Address, create2Salt, readCreationBytecode } from './create2.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// What this checkout found, deployed or stored: SimpleTest's address per chain, and the handles of
// the values stored for the decrypt tests. Not committed (see .gitignore); tsup inlines it into
// dist/ so the tests of this checkout use exactly these.
const REGISTRY_PATH = resolve(__dirname, 'deployments.local.json');

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

// Shares a chain ID with LOCALCOFHE_CHAIN (same devnet genesis, hosted remotely) —
// use a distinct registry key so their deployments.json entries don't collide.
const STAGING_CHAIN = {
  id: 420105,
  label: 'CoFHE Staging',
  rpcEnv: 'STAGING_RPC_URL',
  rpc: 'https://staging-hostchain-v1.sw-dom.co',
  registryKey: '420105-staging',
  // Staging resets periodically and drains the deployer account; auto-top-up from this
  // funder key rather than failing outright when the deployer dips below MIN_BALANCE_ETH.
  funderKeyEnv: 'STAGING_FUNDER_KEY',
  fundAmountEth: '1',
};

const LOCALCOFHE_CHAIN = {
  id: 420105,
  label: 'Local Cofhe',
  rpcEnv: 'LOCALCOFHE_HOST_CHAIN_RPC',
  rpc: 'http://127.0.0.1:42069',
  privateKeyEnv: 'TEST_LOCALCOFHE_PRIVATE_KEY',
};

const CONTRACTS = ['SimpleTest'];

// Calling CREATE2_DEPLOYER (create2.mjs) with `salt ++ initcode` as calldata runs CREATE2, so the
// contract address depends only on the salt and the bytecode: a rebuilt contract lands at a new
// address, an unchanged one is found where the last run left it, and concurrent runs cannot deploy
// duplicates. Chains without code at the deployer address (CoFHE staging, Local CoFHE) fall back to
// `forge create`; since those chains reset, a fresh checkout deploys there once per run.
// The proxy is `msg.sender` while the constructor runs. SimpleTest has no constructor and no owner,
// so nothing records that sender.

// ── Helpers ─────────────────────────────────────────────────────────────────

const run = (cmd) => execSync(cmd, { cwd: __dirname, encoding: 'utf8' }).trim();

function readRegistry() {
  try { return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')); } catch { return {}; }
}

function writeRegistry(reg) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + '\n');
}

function creationBytecode(contractName) {
  return readCreationBytecode(resolve(__dirname, `out/${contractName}.sol/${contractName}.json`));
}

function bytecodeHash(contractName) {
  return '0x' + createHash('sha256').update(creationBytecode(contractName)).digest('hex');
}

const create2AddressOf = (contractName) => create2Address(contractName, creationBytecode(contractName));

const sameAddress = (a, b) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

function hasCodeOnChain(rpc, address) {
  try {
    const code = run(`cast code ${address} --rpc-url ${rpc}`);
    return code !== '0x' && code.length > 2;
  } catch { return false; }
}

function getMaxPriorityFeePerGas(rpc) {
  try {
    return BigInt(JSON.parse(run(`cast rpc --rpc-url ${rpc} eth_maxPriorityFeePerGas`))).toString();
  } catch {
    return null;
  }
}

function getGasPrice(rpc) {
  try {
    return BigInt(JSON.parse(run(`cast rpc --rpc-url ${rpc} eth_gasPrice`))).toString();
  } catch {
    return null;
  }
}

// Local CoFHE needs explicit fee fields; the other chains take the tool's estimates.
function gasArgs(rpc, privateKeyEnvName) {
  const priorityGasPrice =
    privateKeyEnvName === 'TEST_LOCALCOFHE_PRIVATE_KEY' ? getMaxPriorityFeePerGas(rpc) : null;
  const gasPrice = priorityGasPrice ? getGasPrice(rpc) : null;
  const gasPriceArg = gasPrice ? ` --gas-price ${gasPrice}` : '';
  const priorityGasPriceArg = priorityGasPrice ? ` --priority-gas-price ${priorityGasPrice}` : '';
  return `${gasPriceArg}${priorityGasPriceArg}`;
}

function deploy(rpc, privateKeyEnvName, contractName) {
  const out = run(
    `forge create contracts/${contractName}.sol:${contractName} --rpc-url ${rpc} --private-key $${privateKeyEnvName} --broadcast${gasArgs(rpc, privateKeyEnvName)}`
  );
  const addressMatch = out.match(/Deployed to:\s*(0x[0-9a-fA-F]+)/);
  const txMatch = out.match(/Transaction hash:\s*(0x[0-9a-fA-F]+)/);
  if (!addressMatch) throw new Error(`Could not parse deployed address from forge output:\n${out}`);
  return { address: addressMatch[1], txHash: txMatch?.[1] };
}

// Sends `salt ++ initcode` to CREATE2_DEPLOYER and reports whether `address` has code afterwards.
// A failed send still counts when the code is there: another run deployed the same bytecode first,
// and the proxy reverts on a second attempt.
function deployCreate2(rpc, privateKeyEnvName, contractName, address) {
  let txHash;
  let sendError;
  try {
    const data = `${create2Salt(contractName)}${creationBytecode(contractName).slice(2)}`;
    const out = run(
      `cast send ${CREATE2_DEPLOYER} --data ${data} --rpc-url ${rpc} --private-key $${privateKeyEnvName}${gasArgs(rpc, privateKeyEnvName)}`
    );
    txHash = out.match(/transactionHash\s+(0x[0-9a-fA-F]{64})/)?.[1];
  } catch (err) {
    sendError = err;
  }

  if (!hasCodeOnChain(rpc, address)) {
    const error = sendError
      ? sendError.message
      : `CREATE2 transaction ${txHash ?? '(hash not parsed)'} mined but left no code at ${address}`;
    return { ok: false, error };
  }
  return { ok: true, txHash, raced: Boolean(sendError) };
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

const ALL_CHAINS = [
  ...TESTNET_CHAINS,
  ...(process.env.TEST_STAGING_ENABLED === 'true' ? [STAGING_CHAIN] : []),
  LOCALCOFHE_CHAIN,
];
const HARDHAT_MOCK_RPC = 'http://127.0.0.1:8546';
const HARDHAT_MOCK_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HARDHAT_MOCK_STARTING_BALANCE_ETH = '10000';
const MOCKS_ZK_VERIFIER_ADDRESS = '0x0000000000000000000000000000000000005001';
const MOCKS_THRESHOLD_NETWORK_ADDRESS = '0x0000000000000000000000000000000000005002';
const COFHE_ADDRESS_BOOK_ADDRESS = '0xC0F4e00E531a2B086492Ae3DCC1515038307196b';
const MOCKS_TASK_MANAGER_ADDRESS = '0x0000000000000000000000000000000000005000';
const MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY =
  '0x6C8D7F768A6BB4AAFE85E8A2F5A9680355239C7E14646ED62B044E39DE154512';
const MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const MOCKS_ZK_VERIFIER_FUNDING_ETH = '10';

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
    return run(`cast balance ${address} --ether --rpc-url ${rpc} 2>/dev/null`);
  } catch {
    return '?';
  }
}

function getHardhatMockAccount() {
  return run(`cast wallet address ${HARDHAT_MOCK_PRIVATE_KEY}`);
}

function getAccountAddress(privateKey) {
  return privateKeyToAccount(privateKey).address;
}

const MIN_BALANCE_ETH = 0.1;
const underfunded = [];

function tryAutoFund(chain, rpc, address, balanceEth) {
  const funderKeyEnv = chain.funderKeyEnv;
  if (!funderKeyEnv || !process.env[funderKeyEnv]) return null;

  const amount = chain.fundAmountEth || '1';
  if (args.dryRun) {
    console.log(
      `\n  ${yellow(bold('[dry-run]'))} would auto-fund ${chain.label} deployer ${address} (${balanceEth} ETH < ${MIN_BALANCE_ETH}) with ${amount} ETH from ${funderKeyEnv}`
    );
    return { balance: balanceEth, planned: true };
  }

  console.log(
    `\n  ${yellow(bold('Auto-funding'))} ${chain.label} deployer ${address} (${balanceEth} ETH < ${MIN_BALANCE_ETH}) — sending ${amount} ETH from ${funderKeyEnv}...`
  );
  try {
    run(`cast send ${address} --value ${amount}ether --private-key $${funderKeyEnv} --rpc-url ${rpc}`);
  } catch (e) {
    console.error(`  ${red('Auto-funding failed:')} ${e.message}`);
    return null;
  }
  return { balance: getBalanceEther(rpc, address), planned: false };
}

const fundingSections = [];
const fundingSectionsByEnv = new Map();

for (const chain of ALL_CHAINS) {
  // respect --chains: don't balance-gate chains we aren't setting up
  if (args.chains && !args.chains.includes(chain.id)) continue;
  const pkEnvName = getPrivateKeyEnvName(chain);
  let section = fundingSectionsByEnv.get(pkEnvName);

  if (!section) {
    const address = pkEnvName === 'TEST_PRIVATE_KEY'
      ? deployer
      : (process.env[pkEnvName] ? run(`cast wallet address $${pkEnvName}`) : undefined);
    section = { pkEnvName, address, entries: [] };
    fundingSectionsByEnv.set(pkEnvName, section);
    fundingSections.push(section);
  }

  const rpc = process.env[chain.rpcEnv] || chain.rpc;
  if (!section.address) {
    section.entries.push({ label: chain.label, output: `skip — ${pkEnvName} not set` });
    continue;
  }

  let bal = getBalanceEther(rpc, section.address);
  let parsed = parseFloat(bal);
  let autoFundPlanned = false;

  if (!isNaN(parsed) && parsed < MIN_BALANCE_ETH) {
    const funded = tryAutoFund(chain, rpc, section.address, bal);
    if (funded != null) {
      bal = funded.balance;
      autoFundPlanned = funded.planned;
      parsed = parseFloat(bal);
    }
  }

  section.entries.push({ label: chain.label, output: `${colorBalance(bal)} ETH` });
  if (!isNaN(parsed) && parsed < MIN_BALANCE_ETH && !autoFundPlanned) {
    underfunded.push({ label: chain.label, address: section.address, balance: bal });
  }
}

for (const section of fundingSections) {
  const address = section.address || 'unknown';
  console.log(`\nAccount ${bold(address)} funding ('${section.pkEnvName}'):`);
  const labelWidth = section.entries.reduce((max, entry) => Math.max(max, entry.label.length), 0);
  for (const entry of section.entries) {
    console.log(`  ${entry.label.padEnd(labelWidth)}: ${entry.output}`);
  }
}

const hardhatMockAddress = getHardhatMockAccount();
const hardhatMockBalance = getBalanceEther(HARDHAT_MOCK_RPC, hardhatMockAddress);
const hardhatMockOutput = hardhatMockBalance === '?'
  ? `offline — starts with ${bold(HARDHAT_MOCK_STARTING_BALANCE_ETH)} ETH when Anvil is launched`
  : `${colorBalance(hardhatMockBalance)} ETH`;
const mockDecryptSignerAddress = getAccountAddress(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY);
const mockDecryptSignerBalance = getBalanceEther(HARDHAT_MOCK_RPC, mockDecryptSignerAddress);
const mockDecryptSignerOutput = mockDecryptSignerBalance === '?'
  ? `offline — default Anvil account, starts with ${bold(HARDHAT_MOCK_STARTING_BALANCE_ETH)} ETH`
  : `${colorBalance(mockDecryptSignerBalance)} ETH`;
const mockZkVerifierSignerAddress = getAccountAddress(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
const mockZkVerifierSignerBalance = getBalanceEther(HARDHAT_MOCK_RPC, mockZkVerifierSignerAddress);
const mockZkVerifierSignerOutput = mockZkVerifierSignerBalance === '?'
  ? `offline — funded to ${bold(MOCKS_ZK_VERIFIER_FUNDING_ETH)} ETH by deployMocks`
  : `${colorBalance(mockZkVerifierSignerBalance)} ETH`;

console.log(`\nHardhat (Mock) account ${bold(hardhatMockAddress)}:`);
console.log(`  Balance: ${hardhatMockOutput}`);
console.log("  Used by integration-matrix Anvil setup and Hardhat mock test flows.");

console.log(`\nMock accounts on Hardhat (${bold('deployMocks')}):`);
console.log(`  Owner / deployer          ${bold(hardhatMockAddress)}  ${hardhatMockOutput}`);
console.log(`  Decrypt result signer     ${bold(mockDecryptSignerAddress)}  ${mockDecryptSignerOutput}`);
console.log(`  ZK verifier signer        ${bold(mockZkVerifierSignerAddress)}  ${mockZkVerifierSignerOutput}`);
console.log(`  Fixed contracts           MockCoFHEAddressBook ${COFHE_ADDRESS_BOOK_ADDRESS}`);
console.log(`                            MockTaskManager ${MOCKS_TASK_MANAGER_ADDRESS}`);
console.log(`                            MockZkVerifier ${MOCKS_ZK_VERIFIER_ADDRESS}`);
console.log(`                            MockThresholdNetwork ${MOCKS_THRESHOLD_NETWORK_ADDRESS}`);
console.log('  SimpleTest                deployed explicitly where tests need it');

const parsedHardhatBalance = parseFloat(hardhatMockBalance);
if (!isNaN(parsedHardhatBalance) && parsedHardhatBalance < MIN_BALANCE_ETH) {
  underfunded.push({ label: 'Hardhat (Mock)', address: hardhatMockAddress, balance: hardhatMockBalance });
}

const parsedMockDecryptSignerBalance = parseFloat(mockDecryptSignerBalance);
if (!isNaN(parsedMockDecryptSignerBalance) && parsedMockDecryptSignerBalance < MIN_BALANCE_ETH) {
  underfunded.push({ label: 'Hardhat decrypt signer', address: mockDecryptSignerAddress, balance: mockDecryptSignerBalance });
}

const parsedMockZkVerifierSignerBalance = parseFloat(mockZkVerifierSignerBalance);
if (!isNaN(parsedMockZkVerifierSignerBalance) && parsedMockZkVerifierSignerBalance < MIN_BALANCE_ETH) {
  underfunded.push({ label: 'Hardhat ZK verifier signer', address: mockZkVerifierSignerAddress, balance: mockZkVerifierSignerBalance });
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
let deploymentFailed = false;

const targets = args.chains
  ? args.chains.map((id) => ALL_CHAINS.find((c) => c.id === id) || (() => { throw new Error(`Unknown chain ${id}`); })())
  : ALL_CHAINS;

for (const contract of CONTRACTS) {
  const hash = bytecodeHash(contract);
  const create2Target = create2AddressOf(contract);
  console.log(`\n${contract}  bytecodeHash: ${hash.slice(0, 18)}...  CREATE2 address: ${create2Target}`);

  if (!registry[contract]) registry[contract] = {};

  for (const chain of targets) {
    const rpc = process.env[chain.rpcEnv] || chain.rpc;
    const pkEnvName = getPrivateKeyEnvName(chain);
    const pkValue = process.env[pkEnvName];
    const key = chain.registryKey || String(chain.id);
    const entry = registry[contract][key];
    let action, reason;

    if (!pkValue) {
      console.log(`  ${chain.label} (${chain.id}): skip — ${pkEnvName} not set`);
      continue;
    }

    // Detected per chain rather than listed: where the deterministic deployer has code, the decision
    // comes from the computed address and the chain, not from anything recorded locally.
    const useCreate2 = hasCodeOnChain(rpc, CREATE2_DEPLOYER);

    if (useCreate2) {
      const deployed = hasCodeOnChain(rpc, create2Target);
      const recorded = sameAddress(entry?.address, create2Target) && entry.bytecodeHash === hash;
      if (deployed && recorded) {
        action = 'skip'; reason = 'CREATE2 address has code';
      } else if (deployed) {
        action = 'record'; reason = 'CREATE2 address has code, recording it';
      } else {
        action = 'deploy'; reason = 'no code at the CREATE2 address';
      }
    } else if (!entry?.address) {
      action = 'deploy'; reason = 'no registry entry';
    } else if (entry.bytecodeHash === hash && hasCodeOnChain(rpc, entry.address)) {
      action = 'skip'; reason = 'up to date';
    } else if (!entry.bytecodeHash && hasCodeOnChain(rpc, entry.address)) {
      action = 'record'; reason = 'recording bytecodeHash for existing deployment';
    } else {
      action = 'deploy';
      reason = entry.bytecodeHash !== hash ? 'bytecodeHash changed' : 'no code on-chain';
    }

    const via = useCreate2 ? 'CREATE2' : 'forge create, no CREATE2 deployer on this chain';
    console.log(`  ${chain.label} (${chain.id}): ${action} — ${reason} [${via}]`);

    if (action === 'skip') continue;

    if (action === 'record') {
      registry[contract][key] = useCreate2
        ? { address: create2Target, bytecodeHash: hash, deployedAt: new Date().toISOString() }
        : { ...entry, bytecodeHash: hash, deployedAt: entry.deployedAt || new Date().toISOString() };
      changed = true;
      continue;
    }

    if (args.dryRun) { console.log(`    [dry-run] would deploy via ${via}`); continue; }

    const chainDeployer = run(`cast wallet address $${pkEnvName}`);
    const bal = getBalance(rpc, chainDeployer);
    if (bal === '0') { console.error(`    Deployer ${chainDeployer} has 0 balance on ${chain.label}, skipping`); continue; }

    if (useCreate2) {
      const result = deployCreate2(rpc, pkEnvName, contract, create2Target);
      if (!result.ok) {
        console.error(`    FAILED: ${result.error}`);
        deploymentFailed = true;
        continue;
      }
      console.log(
        result.raced
          ? `    Deploy transaction failed, but ${create2Target} has code: another run deployed it first`
          : `    Deployed: ${create2Target}  tx: ${result.txHash}`
      );
      registry[contract][key] = { address: create2Target, bytecodeHash: hash, deployedAt: new Date().toISOString() };
      changed = true;
      continue;
    }

    try {
      const result = deploy(rpc, pkEnvName, contract);
      console.log(`    Deployed: ${result.address}  tx: ${result.txHash}`);
      registry[contract][key] = { address: result.address, bytecodeHash: hash, deployedAt: new Date().toISOString() };
      changed = true;
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      deploymentFailed = true;
    }
  }
}

if (changed) {
  writeRegistry(registry);
  console.log(`\nRegistry updated: ${REGISTRY_PATH}`);
} else if (!deploymentFailed) {
  console.log('\nAll deployments up to date.');
}

if (deploymentFailed) {
  console.error('\nOne or more deployments failed.');
  process.exit(1);
}

// ── Stored values ───────────────────────────────────────────────────────────
//
// The decrypt tests need two handles from SimpleTest on the primary test chain (and on staging
// when enabled): storedValue, readable only by the account that stored it, and publicValue,
// readable by everyone. The fixture is shared and other suites overwrite both, so the tests cannot
// read the current handles from the contract. Setup stores the values, pins the resulting handles
// in deployments.local.json, and the tests use those. A handle stays decryptable after the
// contract moves on, so a checkout reuses its pinned handles for as long as the ACL still allows
// them; a fresh checkout stores once.

const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');
const PRIVATE_VALUE = 42;
const PUBLIC_VALUE = 7;
const TASK_MANAGER_ID = 1;

function castCall(rpc, to, sig, ...callArgs) {
  const argsStr = callArgs.length ? ' ' + callArgs.join(' ') : '';
  return run(`cast call ${to} "${sig}"${argsStr} --rpc-url ${rpc}`);
}

function pinnedValuesReadable(rpc, record, contractAddress, account) {
  if (!record || !sameAddress(record.contractAddress, contractAddress) || !sameAddress(record.account, account)) {
    return false;
  }
  const taskManager = castCall(rpc, COFHE_ADDRESS_BOOK_ADDRESS, 'getTm(uint256)(address)', TASK_MANAGER_ID);
  return (
    castCall(rpc, taskManager, 'isAllowed(uint256,address)(bool)', record.privateValue.ctHash, account) === 'true' &&
    castCall(rpc, taskManager, 'isPubliclyAllowed(uint256)(bool)', record.publicValue.ctHash) === 'true'
  );
}

// Stores `value` through `sig` and returns the handle it produced, read at the block of our own
// transaction so a concurrent write by another suite cannot slip in between.
function storeValue(rpc, pkEnvName, contractAddress, sig, value, hashGetter) {
  console.log(`  ${sig.split('(')[0]}(${value})`);
  const out = run(`cast send ${contractAddress} "${sig}" ${value} --rpc-url ${rpc} --private-key $${pkEnvName}`);
  const block = out.match(/blockNumber\s+(\d+)/)?.[1];
  const blockArg = block ? ` --block ${block}` : '';
  const ctHash = run(`cast call ${contractAddress} "${hashGetter}()(bytes32)" --rpc-url ${rpc}${blockArg}`);
  return { value, ctHash };
}

function initializeValues(chain) {
  const key = chain.registryKey || String(chain.id);
  const contractAddress = registry['SimpleTest']?.[key]?.address;
  if (!contractAddress) {
    console.log(`\n${chain.label}: no SimpleTest deployment, skipping value initialization`);
    return;
  }

  const rpc = process.env[chain.rpcEnv] || chain.rpc;
  const pkEnvName = getPrivateKeyEnvName(chain);
  const account = run(`cast wallet address $${pkEnvName}`);
  const record = registry['SimpleTestValues']?.[key];

  if (pinnedValuesReadable(rpc, record, contractAddress, account)) {
    console.log(`\n${chain.label}: pinned SimpleTest values still readable by ${account}`);
    return;
  }

  if (args.dryRun) {
    console.log(`\n${chain.label}: [dry-run] would store values in SimpleTest ${contractAddress} as ${account}`);
    return;
  }

  console.log(`\nStoring values in SimpleTest ${contractAddress} on ${chain.label} as ${account}...`);
  const privateValue = storeValue(rpc, pkEnvName, contractAddress, 'setValueTrivial(uint256)', PRIVATE_VALUE, 'storedValueHash');
  const publicValue = storeValue(rpc, pkEnvName, contractAddress, 'setPublicValueTrivial(uint256)', PUBLIC_VALUE, 'publicValueHash');
  if (!registry['SimpleTestValues']) registry['SimpleTestValues'] = {};
  registry['SimpleTestValues'][key] = { contractAddress, account, privateValue, publicValue, storedAt: new Date().toISOString() };
  writeRegistry(registry);
  console.log(`  Pinned in ${REGISTRY_PATH}`);
}

for (const chain of targets) {
  if (chain === STAGING_CHAIN || chain.id === PRIMARY_TEST_CHAIN) initializeValues(chain);
}

// ── Write SimpleTest.sol abi ────────────────────────────────────────────────

const SIMPLE_TEST_ABI_PATH = resolve(__dirname, 'src/simpleTestAbi.ts');

function writeSimpleTestAbi() {
  console.log('\nWriting SimpleTest ABI...');

  const abiJson = run('forge inspect contracts/SimpleTest.sol:SimpleTest abi --json');
  const abi = JSON.parse(abiJson);

  const file = `// This file is autogenerated by setup.mjs (writeSimpleTestAbi), do not edit it.
/* eslint-disable */

export const simpleTestAbi = ${JSON.stringify(abi, null, 2)} as const;
`;

  writeFileSync(SIMPLE_TEST_ABI_PATH, file);
  run(`npx prettier --write ${SIMPLE_TEST_ABI_PATH}`);
  console.log(`  ${SIMPLE_TEST_ABI_PATH}`);
}

writeSimpleTestAbi();

// ── Build ───────────────────────────────────────────────────────────────────

console.log('\nBuilding @cofhe/test-setup...');
run('pnpm build');
console.log('Build complete.');
