const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakingContract (ai.sol)", function () {
  async function deployFixture() {
    // Test accounts
    const [owner, alice, bob] = await ethers.getSigners();

    // Two ERC20s: one to stake, one to pay rewards
    const Token = await ethers.getContractFactory("WTC");
    const stakingToken = await Token.deploy("Stake Token", "STK", 1_000_000);
    const rewardToken = await Token.deploy("Reward Token", "RWD", 1_000_000);

    // Weekly reward rate in basis points (100 = 1% per week)
    const weeklyRateBps = 50n; // 0.5% per week
    const Staking = await ethers.getContractFactory("StakingContract");
    const staking = await Staking.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      weeklyRateBps
    );

    const ownerAddr = await owner.getAddress();
    const aliceAddr = await alice.getAddress();
    const bobAddr = await bob.getAddress();

    // Give users staking tokens
    await stakingToken.transfer(aliceAddr, ethers.parseEther("1000"));
    await stakingToken.transfer(bobAddr, ethers.parseEther("1000"));

    // Fund the staking contract with reward tokens
    await rewardToken.approve(await staking.getAddress(), ethers.parseEther("100000"));
    await staking.fundRewards(ethers.parseEther("100000"));

    // Users approve staking contract to transfer their staking tokens
    await stakingToken.connect(alice).approve(await staking.getAddress(), ethers.parseEther("1000"));
    await stakingToken.connect(bob).approve(await staking.getAddress(), ethers.parseEther("1000"));

    return { owner, alice, bob, ownerAddr, aliceAddr, bobAddr, stakingToken, rewardToken, staking };
  }

  it("stakes and tracks balances", async function () {
    const { alice, aliceAddr, staking } = await deployFixture();
    const amount = ethers.parseEther("100");

    // Stake tokens
    await staking.connect(alice).stake(amount);

    // Contract tracks total and per-user stake
    expect(await staking.totalStaked()).to.equal(amount);
    expect(await staking.stakedBalance(aliceAddr)).to.equal(amount);
  });

  it("accrues and pays rewards", async function () {
    const { alice, aliceAddr, rewardToken, staking } = await deployFixture();
    const amount = ethers.parseEther("100");

    await staking.connect(alice).stake(amount);
    // Fast-forward time to accrue rewards
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    // Check pending rewards
    const pending = await staking.earned(aliceAddr);
    expect(pending).to.be.greaterThan(0n);

    // Claim and compare balance change
    const before = await rewardToken.balanceOf(aliceAddr);
    await staking.connect(alice).getReward();
    const after = await rewardToken.balanceOf(aliceAddr);

    expect(after - before).to.equal(pending);
  });

  it("blocks withdraw before lock and allows after lock", async function () {
    const { alice, staking } = await deployFixture();
    const amount = ethers.parseEther("50");

    await staking.connect(alice).stake(amount);
    // Still locked: should revert
    await expect(staking.connect(alice).withdraw(amount)).to.be.revertedWith("Still locked");

    // Move time past the 30 day lock
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now withdraw should succeed
    await expect(staking.connect(alice).withdraw(amount)).to.not.be.reverted;
  });

  it("can emergencyWithdraw before lock", async function () {
    const { alice, aliceAddr, stakingToken, staking } = await deployFixture();
    const amount = ethers.parseEther("10");

    const before = await stakingToken.balanceOf(aliceAddr);
    await staking.connect(alice).stake(amount);
    // Emergency path ignores lock and rewards
    await staking.connect(alice).emergencyWithdraw();
    const after = await stakingToken.balanceOf(aliceAddr);

    expect(after).to.equal(before);
    expect(await staking.totalStaked()).to.equal(0n);
  });

  it("owner can pause staking", async function () {
    const { owner, alice, staking } = await deployFixture();

    // Pause blocks new staking
    await staking.connect(owner).pause();
    await expect(staking.connect(alice).stake(ethers.parseEther("1"))).to.be.revertedWith("Pausable: paused");
  });
});
