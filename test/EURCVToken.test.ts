import hre from "hardhat";
import { expect } from "chai";

describe("EURCVToken", () => {
  let ethers: any;
  let token: any;
  let admin: any;
  let minter: any;
  let user: any;

  beforeEach(async () => {
    const connection = await hre.network.connect();
    ethers = connection.ethers;
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
      .to.be.revert(ethers);
  });

  it("user can burn own tokens", async () => {
    await token.connect(minter).mint(user.address, 1000_000000n);
    await token.connect(user).burn(500_000000n);
    expect(await token.balanceOf(user.address)).to.equal(500_000000n);
  });

  it("admin can pause and unpause", async () => {
    await token.connect(admin).pause();
    await expect(token.connect(minter).mint(user.address, 100n)).to.be.revert(ethers);
    await token.connect(admin).unpause();
    await token.connect(minter).mint(user.address, 100n);
    expect(await token.balanceOf(user.address)).to.equal(100n);
  });
});
