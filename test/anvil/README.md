# @cofhe/test-anvil

Starts one Anvil node with the CoFHE mocks and the test contracts deployed, for vitest `globalSetup` files.

Used by `@cofhe/integration-matrix` for the Hardhat (Mock) chain and by `@cofhe/react` for the hook tests that need a chain. The matrix uses the default port 8546 and `@cofhe/react` passes 8547, so the two can run at the same time. If a node already answers on the port, the start fails instead of reusing it.

`anvil` and `forge` must be on `$PATH`. The test contracts come from `@cofhe/test-setup`, the mocks from `@cofhe/mock-contracts` through `@cofhe/hardhat-3-plugin`'s `deployMocks`.

```ts
import { startAnvilWithMocks, provideAnvil, type AnvilHandle } from '@cofhe/test-anvil';

let anvil: AnvilHandle | undefined;

export async function setup(project) {
  anvil = await startAnvilWithMocks('[my-package][anvil]', 8548); // a port no other suite uses
  provideAnvil(project, anvil.deployment); // tests read it with inject('anvilRpc'), inject('anvilSimpleTest') etc.
}

export async function teardown() {
  anvil?.stop();
}
```

Source only, no build step. Vitest transpiles it when it loads the setup file.
