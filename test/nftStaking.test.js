const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTStaking", function () {
  async function deployFixture() {
    // Test accounts
    const [owner, alice, bob] = await ethers.getSigners();

    // Reward token (ERC20)
    const Token = await ethers.getContractFactory("WTC");
    const rewardToken = await Token.deploy("Reward Token", "RWD", 1_000_000);

    // NFT collection to be staked
    const NFT = await ethers.getContractFactory("MyNFT");
    const nft = await NFT.deploy("Workshop NFT", "WNFT", "ipfs://workshop/");

    const ownerAddr = await owner.getAddress();
    const aliceAddr = await alice.getAddress();
    const bobAddr = await bob.getAddress();

    // Mint a few NFTs to users
    await nft.connect(owner).mint(aliceAddr); // tokenId 1
    await nft.connect(owner).mint(aliceAddr); // tokenId 2
    await nft.connect(owner).mint(bobAddr); // tokenId 3

    // Rewards paid per second per NFT
    const rewardPerSecond = ethers.parseUnits("1", 18);
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    const staking = await NFTStaking.deploy(
      await nft.getAddress(),
      await rewardToken.getAddress(),
      rewardPerSecond
    );

    // Fund rewards so claims can be paid
    await rewardToken.approve(await staking.getAddress(), ethers.parseEther("100000"));
    await staking.fundRewards(ethers.parseEther("100000"));

    // Approve staking contract to transfer NFTs
    await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);
    await nft.connect(bob).setApprovalForAll(await staking.getAddress(), true);

    return { owner, alice, bob, ownerAddr, aliceAddr, bobAddr, nft, rewardToken, staking, rewardPerSecond };
  }

  it("stakes multiple NFTs", async function () {
    const { alice, aliceAddr, nft, staking } = await deployFixture();

    // Stake two NFTs at once
    await staking.connect(alice).stake([1, 2]);

    // Check counters and custody
    expect(await staking.userStakedCount(aliceAddr)).to.equal(2n);
    expect(await staking.totalStaked()).to.equal(2n);
    expect(await nft.ownerOf(1)).to.equal(await staking.getAddress());
    expect(await nft.ownerOf(2)).to.equal(await staking.getAddress());
  });

  it("accrues and claims rewards", async function () {
    const { alice, aliceAddr, rewardToken, staking, rewardPerSecond } = await deployFixture();

    await staking.connect(alice).stake([1, 2]);
    // Fast-forward time to accrue rewards
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine", []);

    // Pending rewards should be >= base expectation
    const pending = await staking.pendingRewards(aliceAddr, [1, 2]);
    expect(pending).to.be.greaterThan(0n);
    expect(pending).to.be.greaterThanOrEqual(100n * rewardPerSecond * 2n);

    const before = await rewardToken.balanceOf(aliceAddr);
    // Claim rewards for the same NFTs
    await staking.connect(alice).claimRewards([1, 2]);
    const after = await rewardToken.balanceOf(aliceAddr);

    expect(after - before).to.be.greaterThanOrEqual(pending);
  });

  it("unstakes and pays pending rewards", async function () {
    const { alice, aliceAddr, nft, rewardToken, staking } = await deployFixture();

    await staking.connect(alice).stake([1]);
    // Let rewards accrue
    await ethers.provider.send("evm_increaseTime", [50]);
    await ethers.provider.send("evm_mine", []);

    const before = await rewardToken.balanceOf(aliceAddr);
    // Unstake returns NFT and pays rewards in one call
    await staking.connect(alice).unstake([1]);
    const after = await rewardToken.balanceOf(aliceAddr);

    expect(after).to.be.greaterThan(before);
    expect(await staking.totalStaked()).to.equal(0n);
    expect(await nft.ownerOf(1)).to.equal(aliceAddr);
  });

  it("rejects non-owner stake and non-staker claim", async function () {
    const { alice, bob, bobAddr, staking } = await deployFixture();

    // Bob can't stake Alice's NFT
    await expect(staking.connect(bob).stake([1])).to.be.revertedWith("not owner");

    // Bob stakes his own NFT
    await staking.connect(bob).stake([3]);
    // Alice can't claim rewards for Bob's NFT
    await expect(staking.connect(alice).claimRewards([3])).to.be.revertedWith("not staker");
    expect(await staking.userStakedCount(bobAddr)).to.equal(1n);
  });

  it("blocks stake when paused", async function () {
    const { owner, alice, staking } = await deployFixture();
    // Only owner can pause staking
    await staking.connect(owner).pause();

    await expect(staking.connect(alice).stake([1])).to.be.revertedWith("Pausable: paused");
  });
});
 
