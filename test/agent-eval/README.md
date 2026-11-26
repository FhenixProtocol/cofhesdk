# Agent eval

Measures how well a coding agent that has never seen `@cofhe/sdk` uses it, and compares SDK versions on that.

Each run gives an agent a small project with the SDK installed from a tarball, a local chain, and one task ("store 4242 encrypted in the vault"). The agent sees what a user's `node_modules` holds and nothing else. The harness then runs the agent's script on a fresh chain and checks the result.

Not part of `pnpm test`. Agent runs cost money and take minutes.

## Commands

Run from `test/agent-eval`.

| Command                                        | Does                                                                                          | Agent cost |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| `pnpm eval:verify`                             | Checks the harness: per task, the starter stub must fail and the reference solution must pass | none       |
| `pnpm eval --refs master,my-branch --trials 5` | Runs every task on every version, 5 times each, then prints the report                        | yes        |
| `pnpm eval:report [results/<dir>]`             | Rebuilds the report of a finished evaluation (default: the latest)                            | none       |
| `pnpm eval:pack --refs master`                 | Only builds and packs a version                                                               | none       |

Flags:

| Flag              | Default     |                                                                                         |
| ----------------- | ----------- | --------------------------------------------------------------------------------------- |
| `--refs a,b`      | `WORKTREE`  | Git refs to compare. `WORKTREE` is this checkout as it is, uncommitted changes included |
| `--tasks x,y`     | all         | Task ids, see `src/tasks.mjs`                                                           |
| `--trials n`      | `1`         | Runs per task and version. Use 5 or more to compare versions                            |
| `--model m`       | CLI default | Passed to `claude --model`                                                              |
| `--budget usd`    | `3`         | Spending cap per run. A run that hits it counts as not finished                         |
| `--timeout s`     | `1200`      | Wall-clock cap per run                                                                  |
| `--concurrency n` | `1`         | Runs in parallel. Each has its own chain                                                |
| `--keep`          | off         | Keep the agent's workspace after the run                                                |
| `--force`         | off         | Repack a ref that is already packed                                                     |

Run `pnpm eval:verify --refs <ref>` on a new ref before spending on it: a version whose reference solutions fail cannot be evaluated.

## What a run does

1. **Pack.** Check the ref out into a git worktree, install, build, and `pnpm pack` `@cofhe/sdk`, `@cofhe/mock-contracts` and `@cofhe/hardhat-plugin`. Cached per commit.
2. **Install.** Copy `fixture/` out of the repository, install the tarballs into it, compile the contract. Cached per version.
3. **Start.** Clone that into a new directory, start `hardhat node` in it (the plugin deploys the mocks), deploy `EvalVault`, write `eval-env.json`, seed the task's starting values.
4. **Agent.** Run `claude --print` in the directory with the task prompt. Tools: shell and files. No web, MCP servers, skills, user settings or memory.
5. **Check.** Rewind the chain to before the agent, seed different values, run the agent's script once, and compare the chain (or the script's output) with what the task requires.

The check reads the chain directly, including the mocks' plaintext store, and never goes through the SDK under test.

## Tasks

| Id              | The agent has to                                          | Checked by                                                                  |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `encrypt-store` | Encrypt a `uint32` and store it                           | Plaintext of `storedValue`                                                  |
| `read-decrypt`  | Read a handle and decrypt it for display                  | The JSON the script prints, against a value seeded after the agent finished |
| `reveal-public` | Decrypt a public value and publish it on chain            | `getRevealedTotal()`, against a value seeded after the agent finished       |
| `batch-inputs`  | Encrypt two `uint64` in one batch and a `bool` in another | Plaintexts of `rangeMin`, `rangeMax`, `enabled`                             |

Prompts name no SDK function. Finding the API is what is measured.

Adding a task: an entry in `src/tasks.mjs`, plus `tasks/<id>/stub.ts` (what the agent starts from) and `tasks/<id>/reference.ts`. Write the reference with APIs that exist in every version you compare, then run `pnpm eval:verify`.

## Reading the report

| Column              | Meaning                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| Passed              | Runs whose script solved the task when re-run by the harness                       |
| Turns (passed runs) | Median agent turns of the runs that passed. The number to compare between versions |
| Turns (all runs)    | Median over every run. Lower is not better on its own: a run can fail fast         |
| Tool errors         | Median number of tool calls that returned an error                                 |
| Cost, Minutes       | Medians, as reported by the CLI                                                    |

"What the agents ran into" counts runs in which the agent hit an import error, a TypeScript error or a `CofheError`, and runs in which it opened the README, the error guide, the type declarations or the SDK source. It shows why two versions differ.

Agent runs vary. One trial per cell says the harness works, nothing more. Read the transcripts of failed runs (`results/<dir>/<run>/transcript.jsonl`) before drawing a conclusion from a number.

## Constraints

- The agent runs shell commands unsandboxed, as you, in a directory under the system temp folder. It is told to stay in that directory; nothing enforces it.
- Needs the `claude` CLI, logged in, on `$PATH`, and the toolchain the packages build with (`pnpm`, `forge`).
- Everything outside `results/` lives in `$COFHE_EVAL_HOME` (default: `<tmp>/cofhe-agent-eval`): tarballs, installed fixtures, and one git worktree per ref. Delete the folder and run `git worktree prune` to reset.
- A machine reboot clears the default location; the next run rebuilds it.
- Mock mode only. The tasks never reach a real CoFHE network, so they say nothing about network errors.
- `fixture/` must stay a project that makes sense on its own: the agent reads all of it. Harness code belongs in `src/`.
