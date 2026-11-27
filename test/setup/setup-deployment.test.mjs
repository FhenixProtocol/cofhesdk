import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATE2_DEPLOYER, create2Address, create2Salt } from './create2.mjs';

const setupDir = dirname(fileURLToPath(import.meta.url));

const FIXTURE_BYTECODE = '0x00';
const FIXTURE_BYTECODE_HASH = '0x' + createHash('sha256').update(FIXTURE_BYTECODE).digest('hex');
const EXPECTED_CREATE2_ADDRESS = create2Address('SimpleTest', FIXTURE_BYTECODE);

// `cast code` answers from two switches: CREATE2_DEPLOYER_PRESENT says whether the chain has the
// deterministic deployer, and the DEPLOYED_MARKER file says whether the computed address has code.
// `cast send` to the deployer behaves per CREATE2_SEND_MODE: ok, fail, fail-but-deployed (another
// run won the race), ok-no-code (mined, nothing at the address). A `cast send` to any other address
// is a value store: it succeeds with a receipt and creates VALUES_MARKER, after which `cast call`
// reports non-zero value hashes. The ACL (`isAllowed`, `isPubliclyAllowed`) answers true only while
// VALUES_ALLOWED is set.
const commandStub = `#!/bin/sh
command=$(basename "$0")
printf '%s %s\\n' "$command" "$*" >> "$CALL_LOG"

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

if [ "$command" = "cast" ]; then
  case "$1" in
    wallet) printf '%s\\n' '0x1111111111111111111111111111111111111111' ;;
    balance)
      case "$*" in
        *--ether*) printf '%s\\n' '10000' ;;
        *) printf '%s\\n' '1' ;;
      esac
      ;;
    code)
      if [ "$(lower "$2")" = "$(lower "${CREATE2_DEPLOYER}")" ]; then
        if [ "$CREATE2_DEPLOYER_PRESENT" = "1" ]; then printf '%s\\n' '0x6000'; else printf '%s\\n' '0x'; fi
      elif [ -f "$DEPLOYED_MARKER" ]; then
        printf '%s\\n' '0x6000'
      else
        printf '%s\\n' '0x'
      fi
      ;;
    rpc) printf '%s\\n' '"0x1"' ;;
    call)
      case "$3" in
        getTm*) printf '%s\\n' '0x0000000000000000000000000000000000005000' ;;
        storedValueHash*|publicValueHash*)
          if [ -f "$VALUES_MARKER" ]; then
            printf '%s\\n' '0x1111111111111111111111111111111111111111111111111111111111111111'
          else
            printf '%s\\n' '0x0000000000000000000000000000000000000000000000000000000000000000'
          fi
          ;;
        isAllowed*|isPubliclyAllowed*) if [ "$VALUES_ALLOWED" = "1" ]; then printf 'true\\n'; else printf 'false\\n'; fi ;;
        *) printf '%s\\n' '0x0' ;;
      esac
      ;;
    send)
      if [ "$(lower "$2")" != "$(lower "${CREATE2_DEPLOYER}")" ]; then
        : > "$VALUES_MARKER"
        printf '%s\\n' 'blockNumber          123'
        printf '%s\\n' 'status               1 (success)'
        exit 0
      fi
      case "$CREATE2_SEND_MODE" in
        ok)
          : > "$DEPLOYED_MARKER"
          printf '%s\\n' 'status               1 (success)'
          printf '%s\\n' 'transactionHash      0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          ;;
        ok-no-code)
          printf '%s\\n' 'transactionHash      0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          ;;
        fail-but-deployed)
          : > "$DEPLOYED_MARKER"
          printf '%s\\n' 'simulated deployer revert' >&2
          exit 1
          ;;
        *)
          printf '%s\\n' 'simulated deployer revert' >&2
          exit 1
          ;;
      esac
      ;;
  esac
elif [ "$command" = "forge" ]; then
  case "$1" in
    create)
      printf '%s\\n' 'simulated deployment failure' >&2
      exit 17
      ;;
    inspect) printf '%s\\n' '[]' ;;
  esac
fi
`;

function runSetup({
  chain = '84532',
  args = [],
  env = {},
  deployerPresent = false,
  alreadyDeployed = false,
  valuesAllowed = false,
  sendMode = 'ok',
  registry,
}) {
  const fixtureDir = mkdtempSync(join(setupDir, '.setup-deployment-'));
  const binDir = join(fixtureDir, 'bin');
  const callLog = join(fixtureDir, 'calls.log');
  const deployedMarker = join(fixtureDir, 'deployed');
  const valuesMarker = join(fixtureDir, 'values-stored');
  const registryPath = join(fixtureDir, 'deployments.local.json');

  try {
    mkdirSync(binDir);
    mkdirSync(join(fixtureDir, 'out', 'SimpleTest.sol'), { recursive: true });
    mkdirSync(join(fixtureDir, 'src'));
    for (const file of ['setup.mjs', 'create2.mjs']) copyFileSync(join(setupDir, file), join(fixtureDir, file));
    writeFileSync(
      join(fixtureDir, 'out', 'SimpleTest.sol', 'SimpleTest.json'),
      JSON.stringify({ bytecode: { object: FIXTURE_BYTECODE } })
    );
    writeFileSync(callLog, '');
    if (alreadyDeployed) writeFileSync(deployedMarker, '');
    if (registry) writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

    for (const command of ['cast', 'forge', 'npx', 'pnpm']) {
      const commandPath = join(binDir, command);
      writeFileSync(commandPath, commandStub.replaceAll('${CREATE2_DEPLOYER}', CREATE2_DEPLOYER));
      chmodSync(commandPath, 0o755);
    }

    const result = spawnSync(process.execPath, ['setup.mjs', '--chains', chain, ...args], {
      cwd: fixtureDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        CALL_LOG: callLog,
        DEPLOYED_MARKER: deployedMarker,
        VALUES_MARKER: valuesMarker,
        VALUES_ALLOWED: valuesAllowed ? '1' : '0',
        CREATE2_DEPLOYER_PRESENT: deployerPresent ? '1' : '0',
        CREATE2_SEND_MODE: sendMode,
        TEST_PRIVATE_KEY: 'placeholder-test-key',
        BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example.invalid',
        ARBITRUM_SEPOLIA_RPC_URL: 'https://arbitrum-sepolia.example.invalid',
        ...env,
      },
    });

    return {
      result,
      calls: readFileSync(callLog, 'utf8'),
      registry: existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf8')) : undefined,
    };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

const BASE_RPC = 'https://base-sepolia\\.example\\.invalid';
const ARB_RPC = 'https://arbitrum-sepolia\\.example\\.invalid';

const create2SendPattern = new RegExp(
  `^cast send ${CREATE2_DEPLOYER} --data ${create2Salt('SimpleTest')}${FIXTURE_BYTECODE.slice(2)} --rpc-url ${BASE_RPC} --private-key `,
  'm'
);

test('create2Address matches the address cast create2 computes for the same inputs', () => {
  // cast create2 --deployer 0x4e59b44847b379578588920cA78FbF26c0B4956C --salt <create2Salt('SimpleTest')> --init-code 0x00
  assert.equal(EXPECTED_CREATE2_ADDRESS, '0x6C57B9759E433995BC6150aA43b4D8AC73409a2b');
});

test('setup exits non-zero when forge create fails on a chain without the CREATE2 deployer', () => {
  const { result, calls } = runSetup({ deployerPresent: false });

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stdout, /deploy — no registry entry \[forge create, no CREATE2 deployer on this chain\]/);
  assert.match(result.stderr, /FAILED:.*forge create.*simulated deployment failure/s);
  assert.doesNotMatch(calls, /^cast send\b/m);
  assert.doesNotMatch(result.stdout, /All deployments up to date|Build complete/);
});

test('deploys through the CREATE2 deployer when the computed address has no code', () => {
  const { result, calls, registry } = runSetup({ deployerPresent: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /deploy — no code at the CREATE2 address \[CREATE2\]/);
  assert.match(result.stdout, new RegExp(`Deployed: ${EXPECTED_CREATE2_ADDRESS}  tx: 0xa{64}`));
  assert.match(calls, create2SendPattern);
  assert.doesNotMatch(calls, /^forge create\b/m);
  assert.equal(registry.SimpleTest['84532'].address, EXPECTED_CREATE2_ADDRESS);
  assert.equal(registry.SimpleTest['84532'].bytecodeHash, FIXTURE_BYTECODE_HASH);
});

test('records the address without deploying when the CREATE2 address already has code', () => {
  const { result, calls, registry } = runSetup({ deployerPresent: true, alreadyDeployed: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /record — CREATE2 address has code, recording it \[CREATE2\]/);
  assert.doesNotMatch(calls, /^cast send\b|^forge create\b/m);
  assert.equal(registry.SimpleTest['84532'].address, EXPECTED_CREATE2_ADDRESS);
});

test('replaces a stale forge-create record with the CREATE2 address without redeploying', () => {
  const stale = {
    SimpleTest: {
      84532: {
        address: '0x2222222222222222222222222222222222222222',
        bytecodeHash: '0xold',
        deployedAt: '2026-08-21T11:09:02.927Z',
      },
    },
  };
  const { result, calls, registry } = runSetup({ deployerPresent: true, alreadyDeployed: true, registry: stale });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(calls, /^cast send\b|^forge create\b/m);
  assert.equal(registry.SimpleTest['84532'].address, EXPECTED_CREATE2_ADDRESS);
  assert.equal(registry.SimpleTest['84532'].bytecodeHash, FIXTURE_BYTECODE_HASH);
});

test('skips a chain whose local record already names the deployed CREATE2 address', () => {
  const current = {
    SimpleTest: {
      84532: {
        address: EXPECTED_CREATE2_ADDRESS,
        bytecodeHash: FIXTURE_BYTECODE_HASH,
        deployedAt: '2026-11-09T00:00:00.000Z',
      },
    },
  };
  const { result, calls, registry } = runSetup({ deployerPresent: true, alreadyDeployed: true, registry: current });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /skip — CREATE2 address has code \[CREATE2\]/);
  assert.match(result.stdout, /All deployments up to date/);
  assert.doesNotMatch(calls, /^cast send\b|^forge create\b/m);
  assert.deepEqual(registry, current);
});

test('dry-run previews a CREATE2 deploy without sending a transaction', () => {
  const { result, calls, registry } = runSetup({ deployerPresent: true, args: ['--dry-run'] });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[dry-run\] would deploy via CREATE2/);
  assert.doesNotMatch(calls, /^cast send\b|^forge create\b/m);
  assert.equal(registry, undefined);
});

test('treats a failed CREATE2 send as success when the address has code afterwards', () => {
  const { result, registry } = runSetup({ deployerPresent: true, sendMode: 'fail-but-deployed' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    new RegExp(`Deploy transaction failed, but ${EXPECTED_CREATE2_ADDRESS} has code: another run deployed it first`)
  );
  assert.doesNotMatch(result.stderr, /FAILED/);
  assert.equal(registry.SimpleTest['84532'].address, EXPECTED_CREATE2_ADDRESS);
});

test('fails when the CREATE2 send fails and the address stays empty', () => {
  const { result, registry } = runSetup({ deployerPresent: true, sendMode: 'fail' });

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /FAILED:.*cast send.*simulated deployer revert/s);
  assert.doesNotMatch(result.stdout, /All deployments up to date|Build complete/);
  assert.equal(registry, undefined);
});

test('fails when the CREATE2 transaction mines but leaves no code at the address', () => {
  const { result, registry } = runSetup({ deployerPresent: true, sendMode: 'ok-no-code' });

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(
    result.stderr,
    new RegExp(`FAILED: CREATE2 transaction 0xa{64} mined but left no code at ${EXPECTED_CREATE2_ADDRESS}`)
  );
  assert.equal(registry, undefined);
});

const PINNED_HASH = '0x' + '1'.repeat(64);
const ACCOUNT = '0x' + '1'.repeat(40);
const deployedOnArbitrum = {
  SimpleTest: {
    421614: {
      address: EXPECTED_CREATE2_ADDRESS,
      bytecodeHash: FIXTURE_BYTECODE_HASH,
      deployedAt: '2026-11-09T00:00:00.000Z',
    },
  },
};
const pinnedValues = {
  contractAddress: EXPECTED_CREATE2_ADDRESS,
  account: ACCOUNT.toLowerCase(),
  privateValue: { value: 42, ctHash: PINNED_HASH },
  publicValue: { value: 7, ctHash: PINNED_HASH },
  storedAt: '2026-11-09T00:00:00.000Z',
};

test('a --chains run for a chain other than the primary stores no values', () => {
  const { result, calls } = runSetup({ deployerPresent: true, alreadyDeployed: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /Storing values|pinned SimpleTest values/);
  assert.doesNotMatch(calls, /setValueTrivial|setPublicValueTrivial|^cast call/m);
});

test('stores the values on the primary test chain and pins the handles it read at its own block', () => {
  const { result, calls, registry } = runSetup({ chain: '421614', deployerPresent: true, alreadyDeployed: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    new RegExp(`Storing values in SimpleTest ${EXPECTED_CREATE2_ADDRESS} on Arbitrum Sepolia as ${ACCOUNT}`)
  );
  assert.match(
    calls,
    new RegExp(`^cast send ${EXPECTED_CREATE2_ADDRESS} setValueTrivial\\(uint256\\) 42 --rpc-url ${ARB_RPC} `, 'm')
  );
  assert.match(
    calls,
    new RegExp(
      `^cast call ${EXPECTED_CREATE2_ADDRESS} storedValueHash\\(\\)\\(bytes32\\) --rpc-url ${ARB_RPC} --block 123$`,
      'm'
    )
  );
  assert.match(
    calls,
    new RegExp(`^cast send ${EXPECTED_CREATE2_ADDRESS} setPublicValueTrivial\\(uint256\\) 7 --rpc-url ${ARB_RPC} `, 'm')
  );
  assert.match(
    calls,
    new RegExp(
      `^cast call ${EXPECTED_CREATE2_ADDRESS} publicValueHash\\(\\)\\(bytes32\\) --rpc-url ${ARB_RPC} --block 123$`,
      'm'
    )
  );
  assert.doesNotMatch(calls, /isAllowed|isPubliclyAllowed/);
  const pinned = registry.SimpleTestValues['421614'];
  assert.equal(pinned.contractAddress, EXPECTED_CREATE2_ADDRESS);
  assert.equal(pinned.account, ACCOUNT);
  assert.deepEqual(pinned.privateValue, { value: 42, ctHash: PINNED_HASH });
  assert.deepEqual(pinned.publicValue, { value: 7, ctHash: PINNED_HASH });
  assert.equal(registry.SimpleTest['421614'].address, EXPECTED_CREATE2_ADDRESS);
});

test('reuses pinned handles while the ACL still allows them for this account', () => {
  const registry = { ...deployedOnArbitrum, SimpleTestValues: { 421614: pinnedValues } };
  const { result, calls } = runSetup({
    chain: '421614',
    deployerPresent: true,
    alreadyDeployed: true,
    valuesAllowed: true,
    registry,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`pinned SimpleTest values still readable by ${ACCOUNT}`));
  assert.match(
    calls,
    new RegExp(
      `^cast call 0x0{36}5000 isAllowed\\(uint256,address\\)\\(bool\\) ${PINNED_HASH} ${ACCOUNT} --rpc-url`,
      'm'
    )
  );
  assert.match(
    calls,
    new RegExp(`^cast call 0x0{36}5000 isPubliclyAllowed\\(uint256\\)\\(bool\\) ${PINNED_HASH} --rpc-url`, 'm')
  );
  assert.doesNotMatch(calls, /^cast send\b/m);
});

test('stores again when the ACL no longer allows the pinned handles', () => {
  const registry = { ...deployedOnArbitrum, SimpleTestValues: { 421614: pinnedValues } };
  const { result, calls } = runSetup({
    chain: '421614',
    deployerPresent: true,
    alreadyDeployed: true,
    valuesAllowed: false,
    registry,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Storing values in SimpleTest/);
  assert.match(calls, /setValueTrivial\(uint256\) 42 /);
});

test('stores again when the pinned handles belong to another account', () => {
  const registry = {
    ...deployedOnArbitrum,
    SimpleTestValues: { 421614: { ...pinnedValues, account: '0x' + '2'.repeat(40) } },
  };
  const { result, calls } = runSetup({
    chain: '421614',
    deployerPresent: true,
    alreadyDeployed: true,
    valuesAllowed: true,
    registry,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Storing values in SimpleTest/);
  assert.doesNotMatch(calls, /isAllowed/);
  assert.match(calls, /setValueTrivial\(uint256\) 42 /);
});

test('dry-run reports the values it would store without sending', () => {
  const { result, calls } = runSetup({
    chain: '421614',
    deployerPresent: true,
    alreadyDeployed: true,
    args: ['--dry-run'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[dry-run\] would store values in SimpleTest/);
  assert.doesNotMatch(calls, /^cast send\b/m);
});
