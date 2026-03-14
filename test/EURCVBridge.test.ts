import hre from "hardhat";
import { expect } from "chai";

describe("EURCVBridge", () => {
  let ethers: any;
  let token: any;
  let bridge: any;
  let admin: any;
  let attesterSigner: any;
  let user: any;
  const LOCAL_DOMAIN = 0; // Ethereum
  const MIN_AMOUNT = 1_000000n; // 1 EURCV
  const MAX_AMOUNT = 1_000_000_000000n; // 1M EURCV

  beforeEach(async () => {
    const connection = await hre.network.connect();
    ethers = connection.ethers;
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
        .to.be.revert(ethers);
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
