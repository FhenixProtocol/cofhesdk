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
    
    style GlobalCheck fill:#fff3e0,stroke:#f57c00,stroke-width:3px,color:#000
    style PermCheck fill:#e0f2f1,stroke:#00897b,stroke-width:3px,color:#000
    style Decrypt fill:#e8f5e9,stroke:#388e3c,stroke-width:3px,color:#000
    style Error fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#000
    style Scenarios fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff
```

---

## Mock Constants & Key Management

```mermaid
graph LR
    subgraph Constants["🔑 Mock Constants<br/>(packages/sdk/core/consts.ts)"]
        DecryptSigner["MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY<br/>0x59c6995e..."]
        DecryptAddress["MOCKS_DECRYPT_RESULT_SIGNER_ADDRESS<br/>0x70997970..."]
        ZkVerifierSigner["MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY<br/>0xc0de..."]
        ZkVerifierAddr["MOCKS_ZK_VERIFIER_ADDRESS"]
    end
    
    subgraph Usage["Where Used"]
        ZkSign["cofheMocksZkVerifySign()<br/>Signs encrypted inputs"]
        DecryptSign["cofheMocksDecryptForTx()<br/>Signs decrypt results"]
        HardhatAccts["Hardhat Plugin Default Accounts"]
    end
    
    subgraph Contracts["Mock Contracts"]
        MockZk["MockZkVerifier<br/>Calculates ctHashes"]
        MockTM["MockTaskManager<br/>Manages decryption"]
    end
    
    ZkVerifierSigner --> ZkSign
    DecryptSigner --> DecryptSign
    DecryptAddress --> HardhatAccts
    
    ZkSign --> MockZk
    DecryptSign --> MockTM
    HardhatAccts --> Contracts
    
    style Constants fill:#ffe0b2,stroke:#ef6c00,stroke-width:3px,color:#000
    style Usage fill:#b3e5fc,stroke:#0277bd,stroke-width:3px,color:#000
    style Contracts fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000
```

---

## Data Flow: From Encryption to Decryption

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

| Component | Mock Mode | Production Mode | Purpose |
|-----------|-----------|-----------------|---------|
| **EncryptInputs** | Uses MockZkVerifier to calculate ctHashes | Uses TFHE + ZK proofs | Generate encrypted inputs |
| **decryptForView** | Reads from MockZkVerifier storage + checks MockACL | Queries Threshold Network API | View calls (no proof needed) |
| **decryptForTx** | Calls MockThresholdNetwork with signature | Calls Threshold Network coprocessor | Transaction submission (with proof) |
| **Permits** | Stored in-memory + validated against MockACL | Stored on-chain + validated by TN | Access control mechanism |
| **Signatures** | Mock signer key (hardcoded for testing) | Real TN signer (from network) | Proof of decryption |
| **State Storage** | In-memory maps in mock contracts | On-chain encrypted state | Where encrypted values live |

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
