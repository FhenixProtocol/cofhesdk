# @cofhe/foundry-plugin

Foundry test utilities for [CoFHE](https://github.com/FhenixProtocol/cofhesdk). Provides `CofheTest` (base test contract with mock deployment) and `CofheClient` (SDK-like client for encrypting inputs, decrypting outputs, and managing permits).

## Installation

**npm / pnpm**

```sh
npm install --save-dev @cofhe/foundry-plugin
```

Add to `foundry.toml`:

```toml
[profile.default]
libs = ["node_modules", "lib"]
remappings = [
  "forge-std/=node_modules/forge-std/src/",
  "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
  "@fhenixprotocol/cofhe-contracts/=node_modules/@fhenixprotocol/cofhe-contracts/",
  "@cofhe/mock-contracts/=node_modules/@cofhe/mock-contracts/",
  "@cofhe/foundry-plugin/=node_modules/@cofhe/foundry-plugin/contracts/"
]
```

**Git submodule**

```sh
git submodule add https://github.com/FhenixProtocol/cofhesdk lib/cofhe-foundry-plugin
# also add @cofhe/mock-contracts as a second submodule or via npm
```

## Usage

Inherit `CofheTest` in your test contract and call `deployMocks()` in `setUp`. Use `createCofheClient()` to get a connected client.

```solidity
import { CofheTest } from "@cofhe/foundry-plugin/CofheTest.sol";
import { CofheClient } from "@cofhe/foundry-plugin/CofheClient.sol";

contract MyTest is CofheTest {
    CofheClient client;
    MyContract target;

    uint256 constant USER_PKEY = 0xac09...;

    function setUp() public {
        deployMocks();
        client = createCofheClient();
        client.connect(USER_PKEY);
        target = new MyContract();
    }

    function testEncryptAndStore() public {
        InEuint32 memory enc = client.createInEuint32(42);

        vm.prank(client.account());
        target.store(enc);

        expectPlaintext(target.eValue(), uint32(42));
    }
}
```

## API

### `CofheTest` (abstract base)

| Function                         | Description                                                  |
| -------------------------------- | ------------------------------------------------------------ |
| `deployMocks()`                  | Deploys all mock contracts and wires them together           |
| `createCofheClient()`            | Returns a new unconnected `CofheClient`                      |
| `enableLogs()` / `disableLogs()` | Toggle plaintext operation logging                           |
| `getPlaintext(ctHash)`           | Returns the stored plaintext for a ciphertext handle         |
| `expectPlaintext(handle, value)` | Asserts the plaintext of an encrypted handle matches `value` |

`getPlaintext` and `expectPlaintext` have typed overloads for `ebool`, `euint8`, `euint16`, `euint32`, `euint64`, `euint128`, and `eaddress`.

### `CofheClient`

| Function                                      | Description                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `connect(pkey)`                               | Sets the active account from a private key                                       |
| `account()`                                   | Returns the connected account address                                            |
| `createInEbool/8/16/32/64/128/address(value)` | Creates a signed encrypted input                                                 |
| `decryptForTx_withoutPermit(ctHash)`          | Decrypts a globally-allowed ciphertext; returns `(ctHash, plaintext, signature)` |
| `decryptForTx_withPermit(ctHash, permit)`     | Decrypts with a permission; returns `(ctHash, plaintext, signature)`             |
| `decryptForView(ctHash, sealingKey, permit)`  | Seals and unseals for off-chain reading                                          |
| `permit_createSelf()`                         | Creates a self-permit for the connected account                                  |
| `permit_createShared(recipient)`              | Creates the issuer half of a shared permit                                       |
| `permit_exportShared(permit)`                 | Strips recipient fields for safe transmission                                    |
| `permit_importShared(export)`                 | Completes a shared permit as the recipient                                       |
