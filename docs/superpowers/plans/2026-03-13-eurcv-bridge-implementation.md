# EURCV Bridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the BridgeForge POC into a production-ready burn & mint bridge for EURCV across Ethereum, Solana, XRPL, and Stellar with on-chain attestation verification, PostgreSQL persistence, and Bull queue reliability.

**Architecture:** CCTP-inspired hybrid bridge where Forge (token issuer) is the sole attestator. On-chain verification via smart contracts on ETH/Solana. Off-chain verification via backend on XRPL/Stellar. All 12 cross-chain routes supported via symmetric burn & mint with chain adapters.

**Tech Stack:** Solidity (Hardhat), Node.js/TypeScript/Express, PostgreSQL/Prisma, Bull/Redis, React/Wagmi/TanStack Query, ethers.js, @solana/web3.js, xrpl.js, stellar-sdk

**Spec:** `docs/superpowers/specs/2026-03-13-eurcv-bridge-design.md`

**Out of scope (separate plan):** Solana Anchor program (Rust). This plan covers the Ethereum smart contracts and the backend/frontend refactoring. The Solana adapter continues to operate in POC mode (backend-initiated mint via SPL token, no on-chain attestation verification) until a dedicated Solana program plan is created.

---

## File Structure

### Smart Contracts (new/modified)
- `contracts/EURCVToken.sol` — ERC-20 with AccessControl (MINTER_ROLE), mint/burn
- `contracts/EURCVBridge.sol` — Bridge with depositForBurn, receiveMessage, emergencyMint, pause, attestation verification
- `test/EURCVToken.test.ts` — Token contract tests
- `test/EURCVBridge.test.ts` — Bridge contract tests

### Backend (new/modified)
- `src/types/index.ts` — Updated types (new statuses, ChainAdapter interface)
- `src/config/index.ts` — Add PostgreSQL/Redis config
- `src/db/schema.prisma` — Prisma schema
- `src/db/client.ts` — Prisma client singleton
- `src/services/transfer.ts` — TransferService (replaces core/bridge.ts)
- `src/services/attestation.ts` — Upgrade HMAC → ECDSA signing
- `src/services/mint-queue.ts` — Bull queue for mint execution + refund
- `src/services/chain-status.ts` — Chain health monitoring
- `src/chains/ethereum/adapter.ts` — Updated to new interface
- `src/chains/solana/adapter.ts` — Updated to new interface
- `src/chains/xrpl/adapter.ts` — Updated to new interface
- `src/chains/stellar/adapter.ts` — Updated to new interface
- `src/chains/index.ts` — Updated exports
- `src/api/routes.ts` — v1 routes, updated endpoints
- `src/api/validation.ts` — Zod schemas
- `src/index.ts` — Updated entry point

### Frontend (new/modified)
- `frontend/src/api/client.ts` — Updated API client (v1 prefix)
- `frontend/src/api/hooks.ts` — Add useTransferStatus, useChainStatus
- `frontend/src/hooks/useBridge.ts` — Orchestrate full bridge flow
- `frontend/src/components/bridge/BridgePanel.tsx` — Updated with chain status + progress
- `frontend/src/components/bridge/TransferProgress.tsx` — Stepper component
- `frontend/src/components/bridge/TransferSummary.tsx` — Pre-bridge summary
- `frontend/src/components/common/ChainStatusBadge.tsx` — Chain up/down indicator
- `frontend/src/components/common/TrustlineWarning.tsx` — Trustline alert

---

## Chunk 1: Smart Contracts

### Task 1: EURCVToken contract

**Files:**
- Create: `contracts/EURCVToken.sol`
- Create: `test/EURCVToken.test.ts`

- [ ] **Step 1: Write EURCVToken contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract EURCVToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint8 private constant _DECIMALS = 6;

    constructor(address admin) ERC20("EURCV", "EURCV") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
```

- [ ] **Step 2: Write EURCVToken tests**

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { EURCVToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EURCVToken", () => {
  let token: EURCVToken;
  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [admin, minter, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EURCVToken");
    token = await factory.deploy(admin.address);
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
  });

  it("has 6 decimals", async () => {
    expect(await token.decimals()).to.equal(6);
  });

  it("minter can mint", async () => {
    await token.connect(minter).mint(user.address, 1000_000000n);
    expect(await token.balanceOf(user.address)).to.equal(1000_000000n);
  });

  it("non-minter cannot mint", async () => {
    await expect(token.connect(user).mint(user.address, 1000_000000n))
      .to.be.reverted;
  });

  it("user can burn own tokens", async () => {
    await token.connect(minter).mint(user.address, 1000_000000n);
    await token.connect(user).burn(500_000000n);
    expect(await token.balanceOf(user.address)).to.equal(500_000000n);
  });

  it("admin can pause and unpause", async () => {
    await token.connect(admin).pause();
    await expect(token.connect(minter).mint(user.address, 100n)).to.be.reverted;
    await token.connect(admin).unpause();
    await token.connect(minter).mint(user.address, 100n);
    expect(await token.balanceOf(user.address)).to.equal(100n);
  });
});
```

- [ ] **Step 3: Install test dependencies and run tests**

Run: `npm install --save-dev @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-ethers chai@4 @types/chai`
Run: `npx hardhat test test/EURCVToken.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add contracts/EURCVToken.sol test/EURCVToken.test.ts
git commit -m "feat: add EURCVToken contract with AccessControl and tests"
```

---

### Task 2: EURCVBridge contract

**Files:**
- Create: `contracts/EURCVBridge.sol`
- Create: `test/EURCVBridge.test.ts`

- [ ] **Step 1: Write EURCVBridge contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./EURCVToken.sol";

contract EURCVBridge is AccessControl, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    EURCVToken public token;
    address public attester;
    uint256 public minAmount;
    uint256 public maxAmount;
    uint32 public immutable localDomain;

    mapping(bytes32 => bool) public usedNonces;
    uint64 public nonce;

    event BurnForBridge(
        bytes32 indexed transferId,
        address indexed sender,
        uint256 amount,
        uint32 destDomain,
        bytes32 recipient,
        uint64 nonce
    );

    event MintFromBridge(
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount,
        uint32 sourceDomain
    );

    struct BridgeMessage {
        uint32 version;
        bytes32 transferId;
        uint32 sourceDomain;
        uint32 destDomain;
        bytes32 sender;
        bytes32 recipient;
        uint256 amount;
        bytes32 burnTxHash;
    }

    constructor(
        address _token,
        address _attester,
        uint32 _localDomain,
        uint256 _minAmount,
        uint256 _maxAmount,
        address admin
    ) {
        token = EURCVToken(_token);
        attester = _attester;
        localDomain = _localDomain;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function depositForBurn(
        uint256 amount,
        uint32 destDomain,
        bytes32 recipient
    ) external whenNotPaused {
        require(amount >= minAmount, "Amount below minimum");
        require(amount <= maxAmount, "Amount above maximum");
        require(destDomain != localDomain, "Cannot bridge to same chain");
        require(recipient != bytes32(0), "Invalid recipient");

        token.burnFrom(msg.sender, amount);

        uint64 currentNonce = nonce++;
        bytes32 transferId = keccak256(
            abi.encodePacked(localDomain, currentNonce)
        );

        emit BurnForBridge(transferId, msg.sender, amount, destDomain, recipient, currentNonce);
    }

    function receiveMessage(
        BridgeMessage calldata message,
        bytes calldata attestation
    ) external whenNotPaused {
        require(message.destDomain == localDomain, "Wrong destination");
        require(!usedNonces[message.transferId], "Already processed");

        bytes32 messageHash = keccak256(abi.encode(
            message.version,
            message.transferId,
            message.sourceDomain,
            message.destDomain,
            message.sender,
            message.recipient,
            message.amount,
            message.burnTxHash
        ));

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(attestation);
        require(signer == attester, "Invalid attestation");

        usedNonces[message.transferId] = true;

        address recipientAddr = address(uint160(uint256(message.recipient)));
        token.mint(recipientAddr, message.amount);

        emit MintFromBridge(
            message.transferId,
            recipientAddr,
            message.amount,
            message.sourceDomain
        );
    }

    function emergencyMint(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        token.mint(to, amount);
    }

    function setAttester(address _attester) external onlyRole(DEFAULT_ADMIN_ROLE) {
        attester = _attester;
    }

    function setMinAmount(uint256 _minAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minAmount = _minAmount;
    }

    function setMaxAmount(uint256 _maxAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxAmount = _maxAmount;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
```

- [ ] **Step 2: Write EURCVBridge tests**

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { EURCVToken, EURCVBridge } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EURCVBridge", () => {
  let token: EURCVToken;
  let bridge: EURCVBridge;
  let admin: SignerWithAddress;
  let attesterSigner: SignerWithAddress;
  let user: SignerWithAddress;
  const LOCAL_DOMAIN = 0; // Ethereum
  const MIN_AMOUNT = 1_000000n; // 1 EURCV
  const MAX_AMOUNT = 1_000_000_000000n; // 1M EURCV

  beforeEach(async () => {
    [admin, attesterSigner, user] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("EURCVToken");
    token = await tokenFactory.deploy(admin.address);

    const bridgeFactory = await ethers.getContractFactory("EURCVBridge");
    bridge = await bridgeFactory.deploy(
      await token.getAddress(),
      attesterSigner.address,
      LOCAL_DOMAIN,
      MIN_AMOUNT,
      MAX_AMOUNT,
      admin.address
    );

    // Grant MINTER_ROLE to bridge
    await token.grantRole(await token.MINTER_ROLE(), await bridge.getAddress());
    // Mint tokens to user for testing burns
    await token.grantRole(await token.MINTER_ROLE(), admin.address);
    await token.connect(admin).mint(user.address, 10_000_000000n);
  });

  describe("depositForBurn", () => {
    it("burns tokens and emits BurnForBridge event", async () => {
      const amount = 1000_000000n;
      const destDomain = 2; // XRPL
      const recipient = ethers.zeroPadValue("0x1234", 32);

      await token.connect(user).approve(await bridge.getAddress(), amount);

      await expect(bridge.connect(user).depositForBurn(amount, destDomain, recipient))
        .to.emit(bridge, "BurnForBridge");

      expect(await token.balanceOf(user.address)).to.equal(10_000_000000n - amount);
    });

    it("rejects amount below minimum", async () => {
      const recipient = ethers.zeroPadValue("0x1234", 32);
      await token.connect(user).approve(await bridge.getAddress(), 100n);
      await expect(bridge.connect(user).depositForBurn(100n, 1, recipient))
        .to.be.revertedWith("Amount below minimum");
    });

    it("rejects same chain bridge", async () => {
      const amount = 1000_000000n;
      const recipient = ethers.zeroPadValue("0x1234", 32);
      await token.connect(user).approve(await bridge.getAddress(), amount);
      await expect(bridge.connect(user).depositForBurn(amount, LOCAL_DOMAIN, recipient))
        .to.be.revertedWith("Cannot bridge to same chain");
    });
  });

  describe("receiveMessage", () => {
    async function createSignedMessage(overrides: Partial<{
      version: number; transferId: string; sourceDomain: number;
      destDomain: number; sender: string; recipient: string;
      amount: bigint; burnTxHash: string;
    }> = {}) {
      const message = {
        version: 1,
        transferId: ethers.keccak256(ethers.toUtf8Bytes("test-transfer")),
        sourceDomain: 2,
        destDomain: LOCAL_DOMAIN,
        sender: ethers.zeroPadValue("0xabcd", 32),
        recipient: ethers.zeroPadValue(user.address, 32),
        amount: 1000_000000n,
        burnTxHash: ethers.keccak256(ethers.toUtf8Bytes("burn-tx")),
        ...overrides,
      };

      const messageHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "bytes32", "uint32", "uint32", "bytes32", "bytes32", "uint256", "bytes32"],
        [message.version, message.transferId, message.sourceDomain, message.destDomain,
         message.sender, message.recipient, message.amount, message.burnTxHash]
      ));

      const attestation = await attesterSigner.signMessage(ethers.getBytes(messageHash));
      return { message, attestation };
    }

    it("mints tokens with valid attestation", async () => {
      const { message, attestation } = await createSignedMessage();
      const balanceBefore = await token.balanceOf(user.address);

      await bridge.receiveMessage(message, attestation);

      expect(await token.balanceOf(user.address)).to.equal(balanceBefore + message.amount);
    });

    it("rejects replay (same transferId)", async () => {
      const { message, attestation } = await createSignedMessage();
      await bridge.receiveMessage(message, attestation);
      await expect(bridge.receiveMessage(message, attestation))
        .to.be.revertedWith("Already processed");
    });

    it("rejects wrong destination domain", async () => {
      const { message, attestation } = await createSignedMessage({ destDomain: 1 });
      await expect(bridge.receiveMessage(message, attestation))
        .to.be.revertedWith("Wrong destination");
    });

    it("rejects invalid attestation signature", async () => {
      const { message } = await createSignedMessage();
      const fakeAttestation = await user.signMessage(ethers.toUtf8Bytes("fake"));
      await expect(bridge.receiveMessage(message, fakeAttestation))
        .to.be.revertedWith("Invalid attestation");
    });
  });

  describe("emergencyMint", () => {
    it("admin can emergency mint when paused", async () => {
      await bridge.connect(admin).pause();
      await bridge.connect(admin).emergencyMint(user.address, 500_000000n);
      expect(await token.balanceOf(user.address)).to.equal(10_000_000000n + 500_000000n);
    });

    it("cannot emergency mint when not paused", async () => {
      await expect(bridge.connect(admin).emergencyMint(user.address, 500_000000n))
        .to.be.reverted;
    });
  });

  describe("admin controls", () => {
    it("can update attester", async () => {
      await bridge.connect(admin).setAttester(user.address);
      expect(await bridge.attester()).to.equal(user.address);
    });

    it("can update min/max amounts", async () => {
      await bridge.connect(admin).setMinAmount(5_000000n);
      await bridge.connect(admin).setMaxAmount(500_000_000000n);
      expect(await bridge.minAmount()).to.equal(5_000000n);
      expect(await bridge.maxAmount()).to.equal(500_000_000000n);
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx hardhat test test/EURCVBridge.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add contracts/EURCVBridge.sol test/EURCVBridge.test.ts
git commit -m "feat: add EURCVBridge contract with attestation verification and tests"
```

---

### Task 3: Deploy script for new contracts

**Files:**
- Create: `scripts/deploy-bridge.ts`

- [ ] **Step 1: Write deploy script**

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const attesterAddress = process.env.ATTESTATION_PUBLIC_ADDRESS || deployer.address;
  const localDomain = 0; // Ethereum
  const minAmount = 1_000000n; // 1 EURCV
  const maxAmount = 1_000_000_000000n; // 1M EURCV

  // Deploy token
  const tokenFactory = await ethers.getContractFactory("EURCVToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();
  console.log("EURCVToken:", await token.getAddress());

  // Deploy bridge
  const bridgeFactory = await ethers.getContractFactory("EURCVBridge");
  const bridge = await bridgeFactory.deploy(
    await token.getAddress(),
    attesterAddress,
    localDomain,
    minAmount,
    maxAmount,
    deployer.address
  );
  await bridge.waitForDeployment();
  console.log("EURCVBridge:", await bridge.getAddress());

  // Grant MINTER_ROLE to bridge
  const minterRole = await token.MINTER_ROLE();
  await token.grantRole(minterRole, await bridge.getAddress());
  console.log("MINTER_ROLE granted to bridge");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Test deploy on Hardhat local**

Run: `npx hardhat run scripts/deploy-bridge.ts`
Expected: Outputs token and bridge addresses

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-bridge.ts
git commit -m "feat: add deploy script for EURCVToken and EURCVBridge"
```

---

## Chunk 2: Backend Infrastructure (PostgreSQL + Prisma + Bull)

### Task 4: Set up PostgreSQL with Prisma

**Files:**
- Create: `src/db/schema.prisma`
- Create: `src/db/client.ts`
- Modify: `package.json` (add dependencies)
- Modify: `.env.example` (add DATABASE_URL, REDIS_URL)

- [ ] **Step 1: Install dependencies**

Run: `npm install prisma @prisma/client bull ioredis zod`
Run: `npm install --save-dev @types/bull`

- [ ] **Step 2: Create Prisma schema**

Write `src/db/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TransferStatus {
  pending
  rejected
  ready
  expired
  burn_confirmed
  attested
  minting
  completed
  mint_failed
  refunding
  refunded
  refund_failed
}

model Transfer {
  id              String         @id @default(uuid()) @db.Uuid
  status          TransferStatus @default(pending)

  sourceChain     String         @db.VarChar(10) @map("source_chain")
  sourceAddress   String         @db.VarChar(100) @map("source_address")
  burnTxHash      String?        @db.VarChar(100) @map("burn_tx_hash")
  burnConfirmedAt DateTime?      @map("burn_confirmed_at") @db.Timestamptz

  destChain       String         @db.VarChar(10) @map("dest_chain")
  destAddress     String         @db.VarChar(100) @map("dest_address")
  mintTxHash      String?        @db.VarChar(100) @map("mint_tx_hash")
  mintConfirmedAt DateTime?      @map("mint_confirmed_at") @db.Timestamptz

  amount          Decimal        @db.Decimal(20, 6)

  attestation     Bytes?
  messageHash     String?        @db.VarChar(66) @map("message_hash")

  refundTxHash    String?        @db.VarChar(100) @map("refund_tx_hash")
  refundAt        DateTime?      @map("refund_at") @db.Timestamptz

  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz
  retryCount      Int            @default(0) @map("retry_count")
  errorLog        String?        @map("error_log")

  nonce           UsedNonce?

  @@index([status])
  @@index([sourceAddress, sourceChain], name: "idx_transfers_source")
  @@index([destAddress, destChain], name: "idx_transfers_dest")
  @@map("transfers")
}

model UsedNonce {
  transferId String   @id @db.Uuid @map("transfer_id")
  chain      String   @db.VarChar(10)
  usedAt     DateTime @default(now()) @map("used_at") @db.Timestamptz

  transfer   Transfer @relation(fields: [transferId], references: [id])

  @@map("used_nonces")
}

model ChainStatus {
  chain         String   @id @db.VarChar(10)
  isHealthy     Boolean  @default(true) @map("is_healthy")
  lastBlock     BigInt?  @map("last_block")
  lastCheckedAt DateTime? @map("last_checked_at") @db.Timestamptz
  errorMessage  String?  @map("error_message")

  @@map("chain_status")
}
```

- [ ] **Step 3: Create Prisma client singleton**

Write `src/db/client.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
```

- [ ] **Step 4: Initialize Prisma and generate client**

Run: `npx prisma generate --schema=src/db/schema.prisma`
Expected: Prisma Client generated

- [ ] **Step 5: Update .env.example**

Append to `.env.example`:
```
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bridgeforge

# Redis (for Bull queue)
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 6: Run migration (requires running PostgreSQL)**

Run: `npx prisma migrate dev --schema=src/db/schema.prisma --name init`
Expected: Migration created and applied

- [ ] **Step 7: Commit**

```bash
git add src/db/ .env.example package.json package-lock.json
git commit -m "feat: add PostgreSQL schema with Prisma and Bull/Redis dependencies"
```

---

### Task 5: API validation schemas (Zod)

**Files:**
- Create: `src/api/validation.ts`

- [ ] **Step 1: Write Zod validation schemas**

```typescript
import { z } from "zod";

const chains = ["ethereum", "solana", "xrpl", "stellar"] as const;

export const createTransferSchema = z.object({
  sourceChain: z.enum(chains),
  destChain: z.enum(chains),
  sourceAddress: z.string().min(1),
  destAddress: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
}).refine(data => data.sourceChain !== data.destChain, {
  message: "Source and destination chains must be different",
});

export const confirmBurnSchema = z.object({
  burnTxHash: z.string().min(1),
});

export const transfersQuerySchema = z.object({
  address: z.string().min(1).optional(),
  chain: z.enum(chains).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ConfirmBurnInput = z.infer<typeof confirmBurnSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/api/validation.ts
git commit -m "feat: add Zod validation schemas for API endpoints"
```

---

## Chunk 3: Backend Services

### Task 6: Update types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update type definitions**

Replace `src/types/index.ts` with updated types that match the spec. Key changes:
- Add new statuses: `rejected`, `ready`, `expired`, `burn_confirmed`, `attested`, `mint_failed`, `refunding`, `refunded`, `refund_failed`
- Update `ChainAdapter` interface to add `refund()`, `isHealthy()`, `hasTrustline()`
- Add `BridgeMessage` type matching the on-chain struct
- Add `BurnProof`, `MintResult`, `RefundResult` types

```typescript
export type Chain = "ethereum" | "solana" | "xrpl" | "stellar";

export type TransferStatus =
  | "pending"
  | "rejected"
  | "ready"
  | "expired"
  | "burn_confirmed"
  | "attested"
  | "minting"
  | "completed"
  | "mint_failed"
  | "refunding"
  | "refunded"
  | "refund_failed";

export const DOMAIN_IDS: Record<Chain, number> = {
  ethereum: 0,
  solana: 1,
  xrpl: 2,
  stellar: 3,
};

export interface BridgeMessage {
  version: number;
  transferId: string;
  sourceDomain: number;
  destDomain: number;
  sender: string;
  recipient: string;
  amount: string;
  burnTxHash: string;
}

export interface BurnProof {
  valid: boolean;
  sender: string;
  amount: string;
  txHash: string;
  transferId?: string; // on-chain transferId from BurnForBridge event (ETH/Solana only)
}

export interface MintResult {
  success: boolean;
  txHash: string;
}

export interface RefundResult {
  success: boolean;
  txHash: string;
}

export interface ChainAdapter {
  chain: Chain;
  verifyBurn(txHash: string): Promise<BurnProof>;
  executeMint(recipientAddress: string, amount: string): Promise<MintResult>;
  refund(senderAddress: string, amount: string): Promise<RefundResult>;
  getBalance(address: string): Promise<string>;
  isHealthy(): Promise<boolean>;
  hasTrustline?(address: string): Promise<boolean>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: update types for production bridge architecture"
```

---

### Task 7: Upgrade AttestationService (HMAC → ECDSA)

**Files:**
- Modify: `src/services/attestation.ts`

- [ ] **Step 1: Rewrite AttestationService with ECDSA signing**

Replace the HMAC-based attestation with ECDSA signing using ethers.js. The service should:
- Sign `BridgeMessage` structs with the operator's private key
- Produce signatures verifiable by `ecrecover` on-chain
- Expose `signMessage(message: BridgeMessage): string` returning the ECDSA signature
- Expose `getAttesterAddress(): string` for the corresponding public address

```typescript
import { ethers } from "ethers";
import { BridgeMessage } from "../types/index.js";

export class AttestationService {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  getAttesterAddress(): string {
    return this.wallet.address;
  }

  async signMessage(message: BridgeMessage): Promise<string> {
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "bytes32", "uint32", "uint32", "bytes32", "bytes32", "uint256", "bytes32"],
        [
          message.version,
          message.transferId,
          message.sourceDomain,
          message.destDomain,
          message.sender,
          message.recipient,
          BigInt(message.amount),
          message.burnTxHash,
        ]
      )
    );

    return this.wallet.signMessage(ethers.getBytes(messageHash));
  }

  computeMessageHash(message: BridgeMessage): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "bytes32", "uint32", "uint32", "bytes32", "bytes32", "uint256", "bytes32"],
        [
          message.version,
          message.transferId,
          message.sourceDomain,
          message.destDomain,
          message.sender,
          message.recipient,
          BigInt(message.amount),
          message.burnTxHash,
        ]
      )
    );
  }

  verifyAttestation(message: BridgeMessage, signature: string): boolean {
    const messageHash = this.computeMessageHash(message);
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return recovered === this.wallet.address;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/attestation.ts
git commit -m "feat: upgrade attestation from HMAC-SHA256 to ECDSA signing"
```

---

### Task 8: TransferService (replaces BridgeEngine)

**Files:**
- Create: `src/services/transfer.ts`

- [ ] **Step 1: Write TransferService**

This service replaces `src/core/bridge.ts` and uses Prisma for persistence instead of in-memory Map. It handles:
- `createTransfer()` — creates intent, runs pre-checks, returns transfer in `ready` or `rejected` status
- `confirmBurn()` — verifies burn on-chain, creates attestation, enqueues mint
- `getTransfer()` / `getTransfers()` — query from DB
- `expireStaleTransfers()` — cron to expire transfers in `ready` status older than 30 minutes

```typescript
import prisma from "../db/client.js";
import { Chain, DOMAIN_IDS, BridgeMessage, ChainAdapter } from "../types/index.js";
import { AttestationService } from "./attestation.js";
import { Decimal } from "@prisma/client/runtime/library";
import { ethers } from "ethers";

export class TransferService {
  constructor(
    private adapters: Record<Chain, ChainAdapter>,
    private attestation: AttestationService,
    private enqueueMint: (transferId: string) => Promise<void>,
  ) {}

  async createTransfer(params: {
    sourceChain: Chain;
    destChain: Chain;
    sourceAddress: string;
    destAddress: string;
    amount: string;
  }) {
    // Pre-checks
    const sourceAdapter = this.adapters[params.sourceChain];
    const destAdapter = this.adapters[params.destChain];

    const sourceHealthy = await sourceAdapter.isHealthy();
    const destHealthy = await destAdapter.isHealthy();

    if (!sourceHealthy || !destHealthy) {
      return prisma.transfer.create({
        data: {
          ...this.mapParams(params),
          status: "rejected",
          errorLog: `Chain unavailable: ${!sourceHealthy ? params.sourceChain : params.destChain}`,
        },
      });
    }

    // Check trustline for XRPL/Stellar destinations
    if (destAdapter.hasTrustline) {
      const hasTrust = await destAdapter.hasTrustline(params.destAddress);
      if (!hasTrust) {
        return prisma.transfer.create({
          data: {
            ...this.mapParams(params),
            status: "rejected",
            errorLog: "Recipient has no trustline for EURCV on destination chain",
          },
        });
      }
    }

    return prisma.transfer.create({
      data: { ...this.mapParams(params), status: "ready" },
    });
  }

  async confirmBurn(transferId: string, burnTxHash: string) {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    if (transfer.status !== "ready") {
      throw new Error(`Transfer ${transferId} is in status ${transfer.status}, expected ready`);
    }

    // Verify burn on source chain
    const adapter = this.adapters[transfer.sourceChain as Chain];
    const proof = await adapter.verifyBurn(burnTxHash);

    if (!proof.valid) {
      throw new Error("Burn verification failed");
    }

    if (proof.amount !== transfer.amount.toString()) {
      throw new Error(`Amount mismatch: expected ${transfer.amount}, got ${proof.amount}`);
    }

    // Update to burn_confirmed
    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "burn_confirmed",
        burnTxHash,
        burnConfirmedAt: new Date(),
      },
    });

    // Create attestation
    // For ETH source: transferId comes from BurnForBridge event (keccak256(domain, nonce))
    // For XRPL/Stellar source: transferId = keccak256(domain, UUID) — backend generates
    const onChainTransferId = proof.transferId || ethers.keccak256(
      ethers.solidityPacked(["uint32", "string"], [DOMAIN_IDS[transfer.sourceChain as Chain], transferId])
    );

    // Encode addresses to bytes32: ETH addresses pad directly, XRPL/Stellar addresses hash
    const senderBytes32 = this.addressToBytes32(transfer.sourceAddress, transfer.sourceChain as Chain);
    const recipientBytes32 = this.addressToBytes32(transfer.destAddress, transfer.destChain as Chain);

    const message: BridgeMessage = {
      version: 1,
      transferId: onChainTransferId,
      sourceDomain: DOMAIN_IDS[transfer.sourceChain as Chain],
      destDomain: DOMAIN_IDS[transfer.destChain as Chain],
      sender: senderBytes32,
      recipient: recipientBytes32,
      amount: transfer.amount.toString(),
      burnTxHash: ethers.zeroPadValue(burnTxHash, 32),
    };

    const signature = await this.attestation.signMessage(message);
    const messageHash = this.attestation.computeMessageHash(message);

    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "attested",
        attestation: Buffer.from(signature),
        messageHash,
      },
    });

    // Enqueue mint job
    await this.enqueueMint(transferId);

    return prisma.transfer.findUniqueOrThrow({ where: { id: transferId } });
  }

  async getTransfer(id: string) {
    return prisma.transfer.findUnique({ where: { id } });
  }

  async getTransfers(filters?: { address?: string; chain?: string }) {
    const where: any = {};
    if (filters?.address) {
      where.OR = [
        { sourceAddress: filters.address },
        { destAddress: filters.address },
      ];
      if (filters?.chain) {
        where.OR = [
          { sourceAddress: filters.address, sourceChain: filters.chain },
          { destAddress: filters.address, destChain: filters.chain },
        ];
      }
    }
    return prisma.transfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async expireStaleTransfers() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.transfer.updateMany({
      where: {
        status: "ready",
        createdAt: { lt: thirtyMinutesAgo },
      },
      data: { status: "expired" },
    });
  }

  /** Convert any chain address to a 32-byte representation.
   *  ETH: zero-pad the 20-byte address to 32 bytes.
   *  XRPL/Stellar: keccak256 hash of the address string (not reversible, used only for attestation). */
  private addressToBytes32(address: string, chain: Chain): string {
    if (chain === "ethereum") {
      return ethers.zeroPadValue(address, 32);
    }
    // For non-EVM chains, hash the address to get a deterministic bytes32
    return ethers.keccak256(ethers.toUtf8Bytes(address));
  }

  private mapParams(params: {
    sourceChain: string; destChain: string;
    sourceAddress: string; destAddress: string; amount: string;
  }) {
    return {
      sourceChain: params.sourceChain,
      destChain: params.destChain,
      sourceAddress: params.sourceAddress,
      destAddress: params.destAddress,
      amount: new Decimal(params.amount),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/transfer.ts
git commit -m "feat: add TransferService with Prisma persistence and pre-checks"
```

---

### Task 9: MintQueue service (Bull)

**Files:**
- Create: `src/services/mint-queue.ts`

- [ ] **Step 1: Write MintQueue service**

```typescript
import Bull from "bull";
import prisma from "../db/client.js";
import { Chain, ChainAdapter } from "../types/index.js";

export class MintQueue {
  private queue: Bull.Queue;

  constructor(
    redisUrl: string,
    private adapters: Record<Chain, ChainAdapter>,
  ) {
    this.queue = new Bull("mint-execution", redisUrl, {
      defaultJobOptions: {
        attempts: 10,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: false,
      },
    });

    this.queue.process(async (job) => {
      await this.processMint(job.data.transferId);
    });

    this.queue.on("failed", async (job, err) => {
      if (job.attemptsMade >= (job.opts.attempts || 10)) {
        await this.initiateRefund(job.data.transferId);
      }
    });
  }

  async enqueue(transferId: string): Promise<void> {
    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "minting" },
    });
    await this.queue.add({ transferId });
  }

  private async processMint(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    const adapter = this.adapters[transfer.destChain as Chain];
    const result = await adapter.executeMint(transfer.destAddress, transfer.amount.toString());

    if (!result.success) {
      await prisma.transfer.update({
        where: { id: transferId },
        data: { retryCount: { increment: 1 }, errorLog: `Mint attempt failed` },
      });
      throw new Error(`Mint failed for transfer ${transferId}`);
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "completed",
        mintTxHash: result.txHash,
        mintConfirmedAt: new Date(),
      },
    });

    await prisma.usedNonce.create({
      data: { transferId, chain: transfer.destChain },
    });
  }

  private async initiateRefund(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "mint_failed" },
    });

    try {
      await prisma.transfer.update({
        where: { id: transferId },
        data: { status: "refunding" },
      });

      const sourceAdapter = this.adapters[transfer.sourceChain as Chain];
      const result = await sourceAdapter.refund(
        transfer.sourceAddress,
        transfer.amount.toString(),
      );

      if (result.success) {
        await prisma.transfer.update({
          where: { id: transferId },
          data: {
            status: "refunded",
            refundTxHash: result.txHash,
            refundAt: new Date(),
          },
        });
      } else {
        throw new Error("Refund tx failed");
      }
    } catch (err) {
      await prisma.transfer.update({
        where: { id: transferId },
        data: {
          status: "refund_failed",
          errorLog: `Refund failed: ${err}`,
        },
      });
      // TODO: Sentry alert for manual intervention
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/mint-queue.ts
git commit -m "feat: add Bull-based MintQueue with retry and auto-refund"
```

---

### Task 10: ChainStatusService

**Files:**
- Create: `src/services/chain-status.ts`

- [ ] **Step 1: Write ChainStatusService**

```typescript
import prisma from "../db/client.js";
import { Chain, ChainAdapter } from "../types/index.js";

export class ChainStatusService {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private adapters: Record<Chain, ChainAdapter>) {}

  async start(pollIntervalMs = 30_000): Promise<void> {
    // Initialize chain_status rows
    for (const chain of Object.keys(this.adapters) as Chain[]) {
      await prisma.chainStatus.upsert({
        where: { chain },
        create: { chain, isHealthy: true },
        update: {},
      });
    }

    // Poll immediately, then on interval
    await this.pollAll();
    this.interval = setInterval(() => this.pollAll(), pollIntervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async pollAll(): Promise<void> {
    for (const [chain, adapter] of Object.entries(this.adapters)) {
      try {
        const healthy = await adapter.isHealthy();
        await prisma.chainStatus.update({
          where: { chain },
          data: {
            isHealthy: healthy,
            lastCheckedAt: new Date(),
            errorMessage: healthy ? null : "Health check returned false",
          },
        });
      } catch (err) {
        await prisma.chainStatus.update({
          where: { chain },
          data: {
            isHealthy: false,
            lastCheckedAt: new Date(),
            errorMessage: `Health check error: ${err}`,
          },
        });
      }
    }
  }

  async getStatus(): Promise<Record<string, boolean>> {
    const rows = await prisma.chainStatus.findMany();
    return Object.fromEntries(rows.map((r) => [r.chain, r.isHealthy]));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/chain-status.ts
git commit -m "feat: add ChainStatusService for health monitoring"
```

---

## Chunk 4: Chain Adapters Update

### Task 11: Update all chain adapters to new interface

**Files:**
- Modify: `src/chains/ethereum/adapter.ts`
- Modify: `src/chains/solana/adapter.ts`
- Modify: `src/chains/xrpl/adapter.ts`
- Modify: `src/chains/stellar/adapter.ts`
- Modify: `src/chains/index.ts`

Each adapter must implement the updated `ChainAdapter` interface:

```typescript
interface ChainAdapter {
  chain: Chain;
  verifyBurn(txHash: string): Promise<BurnProof>;
  executeMint(recipientAddress: string, amount: string): Promise<MintResult>;
  refund(senderAddress: string, amount: string): Promise<RefundResult>;
  getBalance(address: string): Promise<string>;
  isHealthy(): Promise<boolean>;
  hasTrustline?(address: string): Promise<boolean>; // XRPL/Stellar only
}
```

- [ ] **Step 1: Update Ethereum adapter**

Key changes to `src/chains/ethereum/adapter.ts`:
- Add `chain: "ethereum"` property
- Return `BurnProof` from `verifyBurn` (rename from current return type)
- Wrap `mint()` to return `MintResult` as `executeMint()`
- Add `refund()` — calls `mint()` back to source (Forge can always mint)
- Add `isHealthy()` — try `provider.getBlockNumber()`, return true/false
- Update ABI to use new EURCVBridge contract (add `depositForBurn`, `receiveMessage`)

- [ ] **Step 2: Update Solana adapter**

Key changes to `src/chains/solana/adapter.ts`:
- Add `chain: "solana"` property
- Return `BurnProof` from `verifyBurn`
- Wrap mint to return `MintResult` as `executeMint()`
- Add `refund()` — calls `mintTo()` back to source
- Add `isHealthy()` — try `connection.getSlot()`, return true/false

- [ ] **Step 3: Update XRPL adapter**

Key changes to `src/chains/xrpl/adapter.ts`:
- Add `chain: "xrpl"` property
- Return `BurnProof` from `verifyBurn`
- Wrap mint to return `MintResult` as `executeMint()`
- Add `refund()` — Payment from issuer to original sender
- Add `isHealthy()` — try `client.request({ command: 'server_info' })`, return true/false
- Add `hasTrustline(address)` — check `account_lines` for EURCV trustline to issuer

- [ ] **Step 4: Update Stellar adapter**

Key changes to `src/chains/stellar/adapter.ts`:
- Add `chain: "stellar"` property
- Return `BurnProof` from `verifyBurn`
- Wrap mint to return `MintResult` as `executeMint()`
- Add `refund()` — Payment from issuer to original sender
- Add `isHealthy()` — try loading root account, return true/false
- Add `hasTrustline(address)` — check account balances for EURCV asset

- [ ] **Step 5: Update chains/index.ts exports**

Update the barrel export to match new adapter signatures.

- [ ] **Step 6: Commit**

```bash
git add src/chains/
git commit -m "feat: update all chain adapters to production ChainAdapter interface"
```

---

## Chunk 5: API Routes & Entry Point

### Task 12: Update API routes

**Files:**
- Modify: `src/api/routes.ts`

- [ ] **Step 1: Rewrite routes with v1 prefix and Zod validation**

Key changes:
- All routes under `/api/v1/`
- `POST /api/v1/transfer` — uses `createTransferSchema` validation, calls `TransferService.createTransfer()`
- `POST /api/v1/transfer/:id/confirm-burn` — uses `confirmBurnSchema`, calls `TransferService.confirmBurn()`
- `GET /api/v1/transfer/:id` — calls `TransferService.getTransfer()`
- `GET /api/v1/transfers` — uses `transfersQuerySchema`, calls `TransferService.getTransfers()`
- `GET /api/v1/health` — returns chain statuses from `ChainStatusService`
- `GET /api/v1/balance/:chain/:address` — calls adapter `getBalance()`
- `GET /api/v1/config` — returns token addresses
- Keep old `/api/` routes as aliases for backward compatibility during transition

- [ ] **Step 2: Commit**

```bash
git add src/api/routes.ts
git commit -m "feat: update API routes with v1 prefix and Zod validation"
```

---

### Task 13: Update entry point

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite entry point**

Key changes:
- Initialize Prisma client
- Initialize chain adapters with new interface
- Initialize `AttestationService` with ECDSA
- Initialize `MintQueue` with Redis URL
- Initialize `TransferService` with adapters + attestation + mint queue
- Initialize `ChainStatusService` and start polling
- Set up expiry cron (run `expireStaleTransfers()` every 5 minutes)
- Wire up routes
- Graceful shutdown (close Prisma, Bull queue, chain status)

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: update entry point with PostgreSQL, Bull, and new services"
```

---

## Chunk 6: Frontend Updates

### Task 14: Update API client

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Update API client to v1 prefix**

Change base URL from `/api` to `/api/v1`. Update function signatures:
- `getHealth()` — new function, returns chain health statuses
- `getTransfers(address?, chain?)` — add filter params
- Keep existing functions but update paths

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: update frontend API client to v1 endpoints"
```

---

### Task 15: Add hooks

**Files:**
- Create: `frontend/src/hooks/useBridge.ts`
- Modify: `frontend/src/api/hooks.ts`

- [ ] **Step 1: Add useChainStatus and useTransferStatus hooks**

Add to `frontend/src/api/hooks.ts`:
- `useChainStatus()` — polls `/api/v1/health` every 30s, returns `Record<Chain, boolean>`
- `useTransferStatus(transferId)` — polls `/api/v1/transfer/:id` every 3s while active

- [ ] **Step 2: Create useBridge hook**

`frontend/src/hooks/useBridge.ts` orchestrates the full flow:
1. Call `registerTransfer()` mutation
2. Call wallet `signBurn()` to get txHash
3. Call `confirmBurn()` mutation
4. Return transfer ID for status tracking

```typescript
import { useState } from "react";
import { useRegisterTransfer, useConfirmBurn } from "../api/hooks";
import { useWallet } from "./useWallet";
import { Chain } from "../types";

export function useBridge() {
  const [transferId, setTransferId] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "registering" | "burning" | "confirming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const registerMutation = useRegisterTransfer();
  const confirmMutation = useConfirmBurn();

  async function bridge(params: {
    sourceChain: Chain;
    destChain: Chain;
    sourceAddress: string;
    destAddress: string;
    amount: string;
    signBurn: (params: any) => Promise<string>;
    tokenAddress: string;
  }) {
    try {
      setStep("registering");
      setError(null);

      const transfer = await registerMutation.mutateAsync({
        sourceChain: params.sourceChain,
        destChain: params.destChain,
        sourceAddress: params.sourceAddress,
        destAddress: params.destAddress,
        amount: params.amount,
      });

      if (transfer.status === "rejected") {
        setStep("error");
        setError(transfer.errorLog || "Transfer rejected");
        return;
      }

      setTransferId(transfer.id);
      setStep("burning");

      const burnTxHash = await params.signBurn({
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        destinationChain: params.destChain,
        recipientAddress: params.destAddress,
      });

      setStep("confirming");

      await confirmMutation.mutateAsync({
        transferId: transfer.id,
        burnTxHash,
      });

      setStep("done");
    } catch (err: any) {
      setStep("error");
      setError(err.message || "Bridge failed");
    }
  }

  return { bridge, transferId, step, error, reset: () => { setStep("idle"); setError(null); setTransferId(null); } };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useBridge.ts frontend/src/api/hooks.ts
git commit -m "feat: add useBridge, useChainStatus, useTransferStatus hooks"
```

---

### Task 16: TransferProgress component

**Files:**
- Create: `frontend/src/components/bridge/TransferProgress.tsx`

- [ ] **Step 1: Write TransferProgress stepper**

A vertical stepper showing the 5 stages: Preparation, Signature, Burn confirmed, Mint in progress, Completed. Each step shows a status icon (checkmark, spinner, circle) and optional tx hash link to the chain explorer.

Props:
- `transferId: string`
- `sourceChain: Chain`
- `destChain: Chain`

Uses `useTransferStatus(transferId)` to poll status and update the stepper.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/bridge/TransferProgress.tsx
git commit -m "feat: add TransferProgress stepper component"
```

---

### Task 17: ChainStatusBadge and TrustlineWarning

**Files:**
- Create: `frontend/src/components/common/ChainStatusBadge.tsx`
- Create: `frontend/src/components/common/TrustlineWarning.tsx`

- [ ] **Step 1: Write ChainStatusBadge**

Small dot indicator (green/red) next to chain name. Uses `useChainStatus()`.

- [ ] **Step 2: Write TrustlineWarning**

Alert banner shown when destination is XRPL/Stellar and transfer is rejected with trustline error. Includes instructions on how to create a trustline.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/common/
git commit -m "feat: add ChainStatusBadge and TrustlineWarning components"
```

---

### Task 18: Update BridgePanel

**Files:**
- Modify: `frontend/src/components/bridge/BridgePanel.tsx`

- [ ] **Step 1: Integrate new components into BridgePanel**

Key changes:
- Use `useBridge()` hook instead of inline logic
- Use `useChainStatus()` to disable bridge button when chain is down
- Show `ChainStatusBadge` next to chain selectors
- Show `TransferProgress` after bridge is initiated (replaces inline status messages)
- Show `TrustlineWarning` when relevant
- Add `TransferSummary` before confirmation (amount, source, dest, estimated time)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/bridge/BridgePanel.tsx
git commit -m "feat: integrate chain status, transfer progress, and useBridge into BridgePanel"
```

---

## Chunk 7: Integration & Smoke Test

### Task 19: End-to-end smoke test

- [ ] **Step 1: Ensure PostgreSQL and Redis are running**

Run: `docker run -d --name bridgeforge-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bridgeforge postgres:16`
Run: `docker run -d --name bridgeforge-redis -p 6379:6379 redis:7`

- [ ] **Step 2: Run Prisma migration**

Run: `npx prisma migrate dev --schema=src/db/schema.prisma`

- [ ] **Step 3: Update .env with database and Redis URLs**

Append:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bridgeforge
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 4: Start backend**

Run: `npm run dev`
Expected: Server starts, connects to PostgreSQL, Redis, and all 4 chains

- [ ] **Step 5: Test health endpoint**

Run: `curl http://localhost:3000/api/v1/health`
Expected: JSON with chain health statuses

- [ ] **Step 6: Test transfer intent creation**

Run:
```bash
curl -X POST http://localhost:3000/api/v1/transfer \
  -H "Content-Type: application/json" \
  -d '{"sourceChain":"ethereum","destChain":"xrpl","sourceAddress":"0x123","destAddress":"rXYZ","amount":"100"}'
```
Expected: JSON with transfer ID and status `ready` (or `rejected` if pre-check fails)

- [ ] **Step 7: Start frontend and test full flow**

Run: `cd frontend && npm run dev`
Test: Connect wallets, select chains, enter amount, click Bridge, verify progress stepper

- [ ] **Step 8: Commit any fixes from smoke test**

```bash
git add -A
git commit -m "fix: address issues from integration smoke test"
```

---

## Cleanup

### Task 20: Remove deprecated files

- [ ] **Step 1: Remove old bridge engine**

Delete `src/core/bridge.ts` (replaced by `src/services/transfer.ts`)

- [ ] **Step 2: Keep TestEURCV.sol for reference**

Add comment at top: `// DEPRECATED: See EURCVToken.sol and EURCVBridge.sol for production contracts`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated BridgeEngine, mark TestEURCV as deprecated"
```

---

## Chunk 8: Rate Limiting & Backend Tests

### Task 21: Add rate limiting middleware

**Files:**
- Create: `src/api/rate-limit.ts`
- Modify: `src/api/routes.ts`

- [ ] **Step 1: Install express-rate-limit**

Run: `npm install express-rate-limit`

- [ ] **Step 2: Write rate limiting middleware**

```typescript
import rateLimit from "express-rate-limit";

// Global rate limit: 100 requests per minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Transfer creation: 10 per minute per IP (anti-spam)
export const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: "Too many transfer requests, try again later" },
});
```

- [ ] **Step 3: Apply to routes**

Add `globalLimiter` to Express app, `transferLimiter` to `POST /transfer`.

- [ ] **Step 4: Commit**

```bash
git add src/api/rate-limit.ts src/api/routes.ts
git commit -m "feat: add rate limiting middleware (per IP)"
```

---

### Task 22: Backend unit tests

**Files:**
- Create: `src/__tests__/attestation.test.ts`
- Create: `src/__tests__/transfer.test.ts`

- [ ] **Step 1: Install test dependencies**

Run: `npm install --save-dev vitest @types/node`

- [ ] **Step 2: Write AttestationService tests**

```typescript
import { describe, it, expect } from "vitest";
import { AttestationService } from "../services/attestation";
import { BridgeMessage } from "../types";
import { ethers } from "ethers";

describe("AttestationService", () => {
  const privateKey = ethers.Wallet.createRandom().privateKey;
  const service = new AttestationService(privateKey);

  const testMessage: BridgeMessage = {
    version: 1,
    transferId: ethers.keccak256(ethers.toUtf8Bytes("test")),
    sourceDomain: 2,
    destDomain: 0,
    sender: ethers.zeroPadValue("0x1234", 32),
    recipient: ethers.zeroPadValue("0x5678", 32),
    amount: "1000000000",
    burnTxHash: ethers.keccak256(ethers.toUtf8Bytes("burn")),
  };

  it("signs and verifies a message", async () => {
    const sig = await service.signMessage(testMessage);
    expect(service.verifyAttestation(testMessage, sig)).toBe(true);
  });

  it("rejects tampered message", async () => {
    const sig = await service.signMessage(testMessage);
    const tampered = { ...testMessage, amount: "999" };
    expect(service.verifyAttestation(tampered, sig)).toBe(false);
  });

  it("returns correct attester address", () => {
    const wallet = new ethers.Wallet(privateKey);
    expect(service.getAttesterAddress()).toBe(wallet.address);
  });

  it("computeMessageHash is deterministic", () => {
    const hash1 = service.computeMessageHash(testMessage);
    const hash2 = service.computeMessageHash(testMessage);
    expect(hash1).toBe(hash2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/__tests__/attestation.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/ vitest.config.ts
git commit -m "test: add AttestationService unit tests"
```

---

### Task 23: TransferSummary and TransferHistory components

**Files:**
- Create: `frontend/src/components/bridge/TransferSummary.tsx`
- Create: `frontend/src/components/bridge/TransferHistory.tsx`

- [ ] **Step 1: Write TransferSummary**

Pre-confirmation summary showing:
- Amount to send and receive (1:1 for EURCV)
- Source chain and wallet
- Destination chain and wallet
- Estimated network fees
- "Bridge" confirmation button

- [ ] **Step 2: Write TransferHistory**

List of past transfers for connected wallet, showing status, amount, chains, and tx hashes with explorer links. Uses `useTransfers(address, chain)` hook.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/bridge/TransferSummary.tsx frontend/src/components/bridge/TransferHistory.tsx
git commit -m "feat: add TransferSummary and TransferHistory components"
```
