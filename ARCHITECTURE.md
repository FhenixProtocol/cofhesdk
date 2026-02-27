# CoFHE SDK Architecture: Mock vs Production Mode

This document explains how the CoFHE SDK components connect in both mock (local testing) and production modes.

## High-Level Overview

```mermaid
graph TB
    subgraph Client["🖥️ Client Application"]
        CofheSDK["CofheClient SDK"]
        CofheSDK -->|uses| Encrypt["encryptInputs()"]
        CofheSDK -->|uses| DecryptView["decryptForView()"]
        CofheSDK -->|uses| DecryptTx["decryptForTx()"]
    end

    subgraph Mode["Execution Mode"]
        IsMock{Is Mock Mode?}
    end

    subgraph MockMode["🧪 Mock Mode (Local Testing)"]
        MockContracts["Mock Contracts on Hardhat"]
        MockTaskMgr["MockTaskManager"]
        MockACL["MockACL"]
        MockZkVerifier["MockZkVerifier"]
        MockThresholdNet["MockThresholdNetwork"]

        MockTaskMgr -->|manages access| MockACL
        MockACL -->|stores permissions| Handles["Handle Storage"]
        MockZkVerifier -->|calculates ctHashes| Hashes["ctHash Values"]
        MockThresholdNet -->|decrypts| Plaintext["Plaintext Results"]
    end

    subgraph ProdMode["🚀 Production Mode (Testnet/Mainnet)"]
        SmartContracts["User Smart Contracts"]
        ThresholdNetwork["Threshold Network Coprocessor"]
        CoFHEAPI["CoFHE API"]

        SmartContracts -->|reads encrypted| State["Encrypted State"]
        ThresholdNetwork -->|computes FHE ops| Results["FHE Results"]
        CoFHEAPI -->|verifies proofs| Verification["Proof Verification"]
    end

    CofheSDK -->|checks config| IsMock
    IsMock -->|yes| MockMode
    IsMock -->|no| ProdMode

    linkStyle default stroke:#000,stroke-width:3px

    style Client fill:#e1f5ff,stroke:#0277bd,stroke-width:3px,color:#000
    style MockMode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
    style ProdMode fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style Mode fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff
```

---

## Encryption Flow: Mock vs Production

```mermaid
graph LR
    Start["plaintext values"]

    subgraph Mock["📋 MOCK MODE"]
        M1["1. calculateCtHashes<br/>MockZkVerifier.zkVerifyCalcCtHashesPacked()"]
        M2["2. insertCtHashes<br/>Store plaintext in MockZkVerifier"]
        M3["3. createProofSignatures<br/>Sign with MOCKS_ZK_VERIFIER_SIGNER"]
        M4["Return EncryptedInputs<br/>with ctHash + signature"]
    end

    subgraph Prod["🌐 PRODUCTION MODE"]
        P1["1. TFHE Encryption<br/>using FHE public key"]
        P2["2. Pack & Prove<br/>Create Zero-Knowledge Proof"]
        P3["3. Verify with CoFHE<br/>Submit to CoFHE API"]
        P4["Return EncryptedInputs<br/>with proof"]
    end

    Start -->|branch| M1
    Start -->|branch| P1

    M1 --> M2
    M2 --> M3
    M3 --> M4

    P1 --> P2
    P2 --> P3
    P3 --> P4

    M4 --> End["EncryptedInputs ready for tx"]
    P4 --> End

    linkStyle default stroke:#000,stroke-width:3px

    style Mock fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
    style Prod fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style End fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
```

---

## Decryption Flow: decryptForView (View Calls)

```mermaid
graph TD
    Start["decryptForView(ctHash, utype)"]

    subgraph Check["Check Mode"]
        IsMock{Mock Mode?}
    end

    subgraph Mock["📋 MOCK MODE"]
        M1["Get plaintext from<br/>MockZkVerifier storage"]
        M2["Validate permission:<br/>MockACL.isAllowed()"]
        M3["Unseal output using<br/>mock sealing"]
        M4["Return plaintext"]
    end

    subgraph Prod["🌐 PRODUCTION MODE"]
        P1["Query Threshold Network<br/>via CoFHE API"]
        P2["Validate permission<br/>with permit if needed"]
        P3["Unseal output<br/>using TN response"]
        P4["Return plaintext"]
    end

    Start --> IsMock

    IsMock -->|yes| M1
    IsMock -->|no| P1

    M1 --> M2
    M2 -->|allowed| M3
    M2 -->|denied| Error["❌ NotAllowed Error"]
    M3 --> M4

    P1 --> P2
    P2 -->|allowed| P3
    P2 -->|denied| Error
    P3 --> P4

    M4 --> End["plaintext value"]
    P4 --> End

    linkStyle default stroke:#000,stroke-width:3px

    style Mock fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
    style Prod fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style Error fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#000
    style Check fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff
    style End fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
```

---

## Decryption Flow: decryptForTx (Transaction Submission)

```mermaid
graph TD
    Start["decryptForTx(ctHash)"]

    subgraph Check["Check Mode"]
        IsMock{Mock Mode?}
    end

    subgraph Mock["📋 MOCK MODE"]
        M1["Query MockThresholdNetwork<br/>via publicClient.readContract()"]
        M2["Check permission:<br/>isAllowedWithPermission()<br/>or globallyAllowed()"]
        M3["Get plaintext from storage"]
        M4["Generate signature<br/>using MOCKS_DECRYPT_RESULT_SIGNER_KEY"]
        M5["Return DecryptForTxResult<br/>ctHash + decryptedValue + signature"]
    end

    subgraph Prod["🌐 PRODUCTION MODE"]
        P1["Query Threshold Network<br/>for encrypted result"]
        P2["Validate permission<br/>with permit"]
        P3["Get plaintext from TN"]
        P4["Receive TN signature<br/>in response"]
        P5["Return DecryptForTxResult<br/>ctHash + decryptedValue + signature"]
    end

    Start --> IsMock

    IsMock -->|yes| M1
    IsMock -->|no| P1

    M1 --> M2
    M2 -->|allowed| M3
    M2 -->|denied| Error["❌ NotAllowed Error"]
    M3 --> M4
    M4 --> M5

    P1 --> P2
    P2 -->|allowed| P3
    P2 -->|denied| Error
    P3 --> P4
    P4 --> P5

    M5 --> End["DecryptForTxResult<br/>ready to publish"]
    P5 --> End

    linkStyle default stroke:#000,stroke-width:3px

    style Mock fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
    style Prod fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style Error fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#000
    style Check fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff
    style End fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
```

---

## Permission Model: Access Control

```mermaid
graph TB
    Query["Decrypt Request"]

    subgraph Scenarios["Access Control Scenarios"]
        NoPerm["No Permit Provided"]
        WithPerm["Permit Provided"]
    end

    Query --> Scenarios

    subgraph GlobalCheck["Global Allowance Check"]
        CheckGlobal["MockACL.globalAllowed(ctHash)?"]
        CheckGlobal -->|yes| AllowGlobal["✅ Decrypt allowed"]
        CheckGlobal -->|no| DenyGlobal["❌ NotAllowed"]
    end

    subgraph PermCheck["Permit-Based Check"]
        ValidatePerm["Validate Permit:<br/>signature, expiration"]
        ValidatePerm -->|valid| CheckPerm["MockTaskManager<br/>.isAllowedWithPermission()"]
        ValidatePerm -->|invalid| DenyPerm["❌ Permission Invalid"]
        CheckPerm -->|allowed| AllowPerm["✅ Decrypt allowed"]
        CheckPerm -->|denied| DenyAccess["❌ Permission Denied"]
    end

    NoPerm --> GlobalCheck
    WithPerm --> PermCheck

    AllowGlobal --> Decrypt["Proceed with decryption"]
    AllowPerm --> Decrypt
    DenyGlobal --> Error["Error returned"]
    DenyPerm --> Error
    DenyAccess --> Error

    linkStyle default stroke:#000,stroke-width:3px

    style GlobalCheck fill:#fff3e0,stroke:#f57c00,stroke-width:3px,color:#000
    style PermCheck fill:#e0f2f1,stroke:#00897b,stroke-width:3px,color:#000
    style Decrypt fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style Error fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#000
    style Scenarios fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff
```

---

## The Role of ZK Verifier

The **ZK Verifier** is responsible for the **encryption phase** - converting plaintext values into encrypted ciphertext handles (ctHashes) that can be used in smart contracts.

### Where It Lives (and What "Verifier" Means Here)

The SDK uses the term **"ZK Verifier"** for the component that ultimately produces **on-chain verifiable attestations** that an encrypted handle (ctHash) is *well-formed*.

- **Production (testnet/mainnet):** the verifier is an **off-chain verifier service** (configured via `supportedChains[].verifierUrl`).
    - The SDK calls `POST {verifierUrl}/verify` (see `zkPackProveVerify.ts`).
    - That service verifies the ZK proof and returns `(ct_hash, signature)` for each input.
- **Mock mode (Hardhat/local testing):** there is no real ZK proof verification.
    - `MockZkVerifier` (contract) exists only to deterministically derive ctHashes and store ctHash→plaintext mappings for mock FHE operations.
    - The SDK produces a **mock signature** using `MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY` so you can still exercise the "signed input" plumbing.

In other words: **in production, the verifier lives off-chain; on-chain contracts never call it directly.** Contracts only validate a signature that *originates* from the verifier.

### Why Smart Contracts Trust It

The protocol’s trust boundary here is not “an HTTP endpoint”, it’s **an authorization check enforced on-chain**: encrypted inputs are accepted only if they carry a signature that verifies against an **authorized verifier identity** configured in the CoFHE system contracts.

- The on-chain trust anchor is the **Task Manager** contract (the CoFHE system contract your app uses via `FHE.sol`).
- When a contract receives an `EncryptedInput` (ctHash + metadata + signature), the Task Manager verifies the signature and accepts the input only if it was signed by the configured **verifier signer**.
    - You can see the exact mechanism in the mocks: `MockTaskManager.verifyInput()` recovers the signer and compares it against `verifierSigner`.

Operationally, in production the verifier service/API returns signatures that are produced by the verifier’s authorized signing authority *after* the ZK proof checks pass. How that signing authority is implemented is intentionally an off-chain concern (it could be a single signer, an HSM-backed key, or a distributed/threshold signer), but the on-chain rule is stable: **only signatures from the authorized verifier identity are accepted**.

#### What The ZK Proof Checks (Conceptually)

At encryption time the SDK builds a **packed ciphertext list + proof** and sends it to the verifier along with explicit metadata:

- `packed_list`: the serialized ciphertext/proof blob
- `account_addr`, `security_zone`, `chain_id`: metadata that the SDK also bakes into the proof statement (see `constructZkPoKMetadata(...)`)

The verifier’s job is to validate that the submitted blob is a *valid proof* for the expected statement. While the exact circuit/statement is defined by the verifier implementation, the checks are conceptually in this class:

1. **Proof validity under the expected parameters**
    - The proof verifies against the expected CRS and the network’s public FHE key (fetched by the SDK).
2. **Well-formed encryption of the claimed inputs**
    - The prover demonstrates knowledge of plaintext(s) and encryption randomness such that the ciphertext list is a correct encryption of those plaintexts.
    - The packed representation is consistent (no malformed ciphertext encoding).
3. **Metadata binding (anti-replay / context binding)**
    - The proof is bound to `(account_addr, security_zone, chain_id)` so the resulting ciphertext handles cannot be reused out of context.
4. **Type/size constraints enforced by the SDK**
    - The SDK refuses to build proofs exceeding 2048 total bits (`MAX_ENCRYPTABLE_BITS`) and encodes values according to the selected `FheTypes.*`.
    - (Whether the verifier redundantly enforces these constraints is verifier-defined; the important part is: the proof corresponds to the packed encoding the SDK produced.)

If these checks pass, the verifier returns a **ctHash** (handle derived from the proven ciphertext) and a **signature** that attests: “this ctHash corresponds to a ciphertext proven valid under the expected metadata”. The signature is what the on-chain Task Manager ultimately authenticates.

The contract “trusts the verifier” in the same way it “trusts an oracle”: through governance/deployment configuration plus cryptographic authentication.

1. The contract already trusts the Task Manager system contract.
2. The Task Manager is configured (by the protocol / deployment owner) with the expected `verifierSigner` address.
3. A valid signature from that address is treated as an attestation: “this ctHash corresponds to a correctly generated ciphertext under the expected metadata (chain/security zone/account)”.

This turns “trust the verifier” into a standard on-chain pattern: **trust a key that can be rotated and governed**, rather than trusting an off-chain process directly.

### What It Does

**In Mock Mode (Local Testing):**

1. **Calculates ctHashes**: Takes plaintext values and generates deterministic ciphertext handles
2. **Stores Mappings**: Writes `ctHash → plaintext` into the mock on-chain storage (via `MockZkVerifier` → `MockTaskManager`) so mock FHE ops can “decrypt” later
3. **Signs Inputs**: Creates a signature using `MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY` to prove the encrypted inputs are valid

**In Production:**

1. **TFHE Encryption**: Performs actual Fully Homomorphic Encryption using the network's public key
2. **Zero-Knowledge Proofs**: Generates cryptographic proofs that the encryption was done correctly
3. **CoFHE Verification**: Submits proofs to the CoFHE verifier service/API (`supportedChains[].verifierUrl`) which verifies and returns signatures for on-chain validation

### Why It's Called "ZK Verifier"

The name comes from **Zero-Knowledge Proof Verification** - in production, this component verifies that:

- The encrypted data was created correctly
- The encryption matches the claimed plaintext structure
- No one can learn anything about the plaintext from the proof

In mock mode, we skip the heavy cryptographic operations but maintain the same API structure.

### Why It's Required: The Trust Problem

**Without ZK Verifier, there's no way to trust encrypted inputs:**

❌ **Attack Without ZK Verifier:**

```solidity
// Malicious user could submit fake encrypted data:
bytes32 fakeCtHash = 0xabcd1234...; // Just random bytes, not actual encryption
contract.storeValue(fakeCtHash);    // Contract accepts it blindly
// Later: Decryption fails or returns garbage
```

✅ **Protection With ZK Verifier:**

```solidity
// ZK Verifier ensures the ctHash is legitimate:
EncryptedInputs memory inputs = client.encryptInputs([42, 100]).execute();
// inputs.ctHashes[0] comes with a valid signature/proof
// CoFHE system contracts (Task Manager via FHE.sol) verify the signature on-chain
contract.storeValue(inputs.ctHashes[0], inputs.signatures[0]);
// If signature is invalid → the CoFHE verification step reverts
```

**The Core Security Guarantee:**

The ZK Verifier solves the **"Who encrypted this?"** problem:

1. 🔴 **Without it**: Anyone can create arbitrary ctHash values and claim they're encrypted
2. 🟢 **With it**: Only properly encrypted data (with valid signatures/proofs) is accepted

**In Production:** The ZK proof mathematically guarantees that:

- The ctHash was generated from actual encrypted data
- The encryption used the correct public key
- The data structure matches what the smart contract expects

**In Mock Mode:** The signature from `MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY` serves the same purpose:

- Only SDK-generated ctHashes have valid signatures
- Smart contracts (via the CoFHE Task Manager) can verify the signature before accepting encrypted inputs
- Tests can't accidentally use invalid/corrupted encrypted data

Note: in some mock/debug deployments the verifier signer may be intentionally unset (`verifierSigner == address(0)`), which disables signature checks.

### Key Insight

Think of ZK Verifier as the **"encryption gateway"**:

- **Before**: You have plaintext numbers (42, 100, 256)
- **After**: You have encrypted handles (ctHashes) that can be safely used in smart contracts
- **Guarantee**: The ZK proof ensures the encryption is valid without revealing the plaintext

```mermaid
graph LR
    Plaintext["Plaintext Values<br/>42, 100, 256"]

    subgraph ZKVerifier["🔐 ZK Verifier"]
        Encrypt["Encrypt Each Value"]
        Proof["Generate Proof"]
        Sign["Sign with ZK Signer"]
    end

    Ciphertext["Encrypted Handles<br/>0xabc..., 0xdef..., 0x123..."]
    SmartContract["Smart Contract<br/>Can use these safely"]

    Plaintext --> Encrypt
    Encrypt --> Proof
    Proof --> Sign
    Sign --> Ciphertext
    Ciphertext --> SmartContract

    linkStyle default stroke:#000,stroke-width:3px

    style ZKVerifier fill:#e1f5ff,stroke:#0277bd,stroke-width:3px,color:#000
    style Plaintext fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
    style Ciphertext fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style SmartContract fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
```

**Related Components:**

- **MockZkVerifier** (contract): Stores the ctHash→plaintext mappings in mock mode
- **MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY** (constant): Used to sign encrypted inputs
- **cofheMocksZkVerifySign()** (function): SDK function that performs mock encryption

---

## Mock Constants & Key Management

```mermaid
graph LR
    subgraph Constants["🔑 Mock Constants"]
        DecryptSigner["MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY<br/>0x59c6995e..."]
        ZkVerifierSigner["MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY<br/>0x6C8D7F76..."]
    end

    subgraph Usage["📍 Where Used"]
        ZkSign["cofheMocksZkVerifySign()<br/>Signs encrypted inputs"]
        DecryptSign["cofheMocksDecryptForTx()<br/>Signs decrypt results"]
        HardhatAccts["Hardhat Plugin Default Accounts"]
    end

    subgraph Contracts["📄 Mock Contracts"]
        MockZk["MockZkVerifier<br/>Calculates ctHashes"]
        MockTM["MockTaskManager<br/>Manages decryption"]
    end

    ZkVerifierSigner --> ZkSign
    DecryptSigner --> DecryptSign

    ZkSign --> MockZk
    DecryptSign --> MockTM
    HardhatAccts --> Contracts

    linkStyle default stroke:#000,stroke-width:3px

    style Constants fill:#ffe0b2,stroke:#ef6c00,stroke-width:3px,color:#000
    style Usage fill:#b3e5fc,stroke:#0277bd,stroke-width:3px,color:#000
    style Contracts fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
```

---

## Data Flow: From Encryption to Decryption (Mock Mode)

**This sequence diagram shows the complete flow in mock/testing mode. In production, the steps are similar but use Threshold Network API instead of mock contracts.**

```mermaid
sequenceDiagram
    participant User as User Code
    participant SDK as CofheSDK
    participant Mock as Mock Contracts
    participant Storage as Storage

    User->>SDK: encryptInputs([plaintext1, plaintext2])

    Note over SDK,Mock: ENCRYPTION PHASE
    SDK->>Mock: MockZkVerifier.zkVerifyCalcCtHashesPacked()
    Mock-->>SDK: [ctHash1, ctHash2]

    SDK->>Mock: MockZkVerifier.insertPackedCtHashes()
    Mock->>Storage: store ctHash → plaintext mapping

    SDK->>SDK: Sign with ZK Verifier Key
    SDK-->>User: EncryptedInputs[ctHash1, ctHash2]

    User->>User: Write encrypted inputs to smart contract

    Note over SDK,Mock: DECRYPTION PHASE (decryptForView)
    User->>SDK: decryptForView(ctHash1, utype)
    SDK->>Mock: MockACL.isAllowed(ctHash1, account)
    Mock-->>SDK: allowed=true
    SDK->>Mock: MockZkVerifier.getPlaintext(ctHash1)
    Mock->>Storage: retrieve mapping
    Storage-->>Mock: plaintext1
    Mock-->>SDK: plaintext1
    SDK-->>User: plaintext1

    Note over SDK,Mock: DECRYPTION PHASE (decryptForTx)
    User->>SDK: decryptForTx(ctHash1)
    SDK->>Mock: MockThresholdNetwork.decryptForTx(ctHash1)
    Mock->>Mock: Check permission
    Mock->>Storage: Get plaintext
    Mock->>SDK: plaintext + signature
    SDK-->>User: DecryptForTxResult{ctHash, value, signature}

    User->>User: publishDecryptResult(ctHash1, plaintext1, sig)
```

---

## Component Interaction Matrix

| Component          | Mock Mode                                                                                             | Production Mode                                                                 | Purpose                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **EncryptInputs**  | Uses MockZkVerifier to calculate ctHashes                                                             | Uses TFHE + ZK proofs                                                           | Generate encrypted inputs                                          |
| **decryptForView** | Reads from MockZkVerifier storage + checks MockACL, returns sealed plaintext, unseals with permit key | Queries Threshold Network for sealed plaintext, unseals with permit sealing key | View calls (read & unseal plaintext, no proof)                     |
| **decryptForTx**   | Calls MockThresholdNetwork with permission check, gets plaintext + signature                          | Queries Threshold Network for plaintext + signature                             | Transaction submission (needs signature for on-chain verification) |
| **Permits**        | Stored in-memory + validated against MockACL                                                          | Stored on-chain + validated by TN                                               | Access control mechanism                                           |
| **Signatures**     | Mock signer key (hardcoded for testing)                                                               | Real TN signer (from network)                                                   | Proof of decryption                                                |
| **State Storage**  | In-memory maps in mock contracts                                                                      | On-chain encrypted state                                                        | Where encrypted values live                                        |

---

## Key Insight: The Abstraction

The CoFHE SDK provides a **unified API** that works identically in both modes:

```typescript
// Same code works in both mock and production!
const encrypted = await client.encryptInputs([Encryptable.uint32(42)]).execute();
const plaintext = await client.decryptForView(encrypted[0].ctHash, FheTypes.Uint32).execute();
```

The difference is **implementation**:

- **Mock**: Direct function calls to in-memory contracts
- **Production**: RPC calls to network (Threshold Network, CoFHE API)

This allows developers to:

1. ✅ Test locally with mocks (fast, no network)
2. ✅ Deploy same code to production (testnet/mainnet)
3. ✅ Debug with complete visibility in mock mode
4. ✅ Trust that production will work the same way

---

## Files Reference

**Mock Implementations:**

- `packages/sdk/core/encrypt/cofheMocksZkVerifySign.ts` - Encryption in mock mode
- `packages/sdk/core/decrypt/cofheMocksDecryptForTx.ts` - decryptForTx in mock mode
- `packages/sdk/core/decrypt/cofheMocksDecryptForView.ts` - Decrypting in view calls (mock mode)
- `packages/mock-contracts/contracts/MockTaskManager.sol` - Main mock contract
- `packages/mock-contracts/contracts/MockACL.sol` - Permission management

**Client API:**

- `packages/sdk/core/client.ts` - CofheClient implementation
- `packages/sdk/core/decrypt/decryptForViewBuilder.ts` - decryptForView builder
- `packages/sdk/core/decrypt/decryptForTxBuilder.ts` - decryptForTx builder

**Tests:**

- `packages/hardhat-plugin-test/test/decryptForTx-builder.test.ts` - Builder tests
- `packages/hardhat-plugin-test/test/decryptForTx-publish.test.ts` - Publish flow test
