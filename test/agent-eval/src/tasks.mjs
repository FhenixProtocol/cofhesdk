// The tasks. Each one is a script the agent has to implement in the fixture project.
//
// - `prompt`: what the agent is asked, in a user's words. No SDK API names: finding them is the test.
// - `seed(chain, attempt)`: puts the chain in the task's starting state. It runs once before the
//   agent starts and again, with a different `attempt`, before the check: a script that hard-coded
//   what it saw the first time fails.
// - `check(chain, run, seeded)`: decides pass or fail from the chain and from what the script printed.

const PREAMBLE = `This is a small Hardhat project with one contract, contracts/EvalVault.sol. It is compiled and deployed to a local Hardhat node, which is running with the CoFHE mock contracts. scripts/env.ts gives you viem clients, the account, and the vault's address and ABI. @cofhe/sdk is installed. Run a script with: npx tsx scripts/<name>.ts

There is no internet access: everything you need is in this directory. Do not change the contract, scripts/env.ts or eval-env.json. When the script works, stop.`;

const fail = (reason) => ({ pass: false, reason });
const PASS = { pass: true, reason: '' };

/** The last line of the script's output that parses as a JSON object. */
const lastJsonLine = (stdout) => {
  for (const line of stdout.trim().split('\n').reverse()) {
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object') return value;
    } catch {
      // not JSON, keep looking
    }
  }
  return undefined;
};

export const TASKS = [
  {
    id: 'encrypt-store',
    title: 'Encrypt a value and store it',
    script: 'store.ts',
    prompt: `${PREAMBLE}

Implement scripts/store.ts so that it stores the value 4242 in the vault's storedValue, encrypted with @cofhe/sdk. The script must exit with code 0.`,
    seed: async () => ({}),
    check: async (chain) => {
      const plaintext = await chain.plaintextOf(await chain.readVault('storedValue'));
      if (plaintext === undefined) return fail('storedValue holds no encrypted value');
      return plaintext === 4242n ? PASS : fail(`storedValue decrypts to ${plaintext}, expected 4242`);
    },
  },
  {
    id: 'read-decrypt',
    title: 'Read an encrypted value and decrypt it for display',
    script: 'read.ts',
    prompt: `${PREAMBLE}

Implement scripts/read.ts so that it reads the vault's storedValue, decrypts it with @cofhe/sdk, and prints one line of JSON as the last line of its output: {"value":"<the number>"}. The stored value changes between runs, so do not hard-code it. The script must exit with code 0.`,
    seed: async (chain, attempt) => {
      const secret = 1000 + attempt * 7919 + Math.floor(Math.random() * 1000);
      await chain.writeVault('seedValue', [secret]);
      return { secret };
    },
    check: async (_chain, run, seeded) => {
      const printed = lastJsonLine(run.stdout);
      if (!printed) return fail('no JSON line in the output');
      return String(printed.value) === String(seeded.secret)
        ? PASS
        : fail(`printed value ${JSON.stringify(printed.value)}, expected "${seeded.secret}"`);
    },
  },
  {
    id: 'reveal-public',
    title: 'Decrypt a public value and publish it on chain',
    script: 'reveal.ts',
    prompt: `${PREAMBLE}

Implement scripts/reveal.ts so that it publishes the plaintext of the vault's publicTotal on chain by calling revealTotal. After it runs, getRevealedTotal() must return the total and true. The total changes between runs, so do not hard-code it. The script must exit with code 0.`,
    seed: async (chain, attempt) => {
      const total = 50_000 + attempt * 104_729 + Math.floor(Math.random() * 10_000);
      await chain.writeVault('seedPublicTotal', [BigInt(total)]);
      return { total };
    },
    check: async (chain, _run, seeded) => {
      const [total, revealed] = await chain.readVault('getRevealedTotal');
      if (!revealed) return fail('getRevealedTotal() says the total was not published');
      return total === BigInt(seeded.total) ? PASS : fail(`published total ${total}, expected ${seeded.total}`);
    },
  },
  {
    id: 'batch-inputs',
    title: 'Encrypt several inputs, of two types, for two calls',
    script: 'configure.ts',
    prompt: `${PREAMBLE}

Implement scripts/configure.ts so that it sets the vault's range to a minimum of 10 and a maximum of 500 with a single call to setRange, and sets enabled to true. All three values must be encrypted with @cofhe/sdk. The script must exit with code 0.`,
    seed: async () => ({}),
    check: async (chain) => {
      const expected = { rangeMin: 10n, rangeMax: 500n, enabled: 1n };
      for (const [name, value] of Object.entries(expected)) {
        const plaintext = await chain.plaintextOf(await chain.readVault(name));
        if (plaintext === undefined) return fail(`${name} holds no encrypted value`);
        if (plaintext !== value) return fail(`${name} decrypts to ${plaintext}, expected ${value}`);
      }
      return PASS;
    },
  },
];

export const taskById = (id) => {
  const task = TASKS.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Unknown task "${id}". Tasks: ${TASKS.map((t) => t.id).join(', ')}`);
  return task;
};
