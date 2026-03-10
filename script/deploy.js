const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddr = await deployer.getAddress();

  console.log("Deploying with:", deployerAddr);

  // Deploy reward token (WTC)
  const Token = await hre.ethers.getContractFactory("WTC");
  const rewardToken = await Token.deploy("Workshop Token", "WTC", 1_000_000);
  await rewardToken.waitForDeployment();
  const rewardTokenAddr = await rewardToken.getAddress();
  console.log("WTC:", rewardTokenAddr);

  // Deploy staking token (could be same as reward token)
  const stakingToken = await Token.deploy("Stake Token", "STK", 1_000_000);
  await stakingToken.waitForDeployment();
  const stakingTokenAddr = await stakingToken.getAddress();
  console.log("Stake Token:", stakingTokenAddr);

  // Deploy NFT collection
  const NFT = await hre.ethers.getContractFactory("MyNFT");
  const nft = await NFT.deploy("Workshop NFT", "WNFT", "ipfs://workshop/");
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("MyNFT:", nftAddr);

  // Deploy ERC20 staking contract (ai.sol)
  const rewardRate = 1n; // reward per second per token (scaled by contract math)
  const Staking = await hre.ethers.getContractFactory("StakingContract");
  const staking = await Staking.deploy(stakingTokenAddr, rewardTokenAddr, rewardRate);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("StakingContract:", stakingAddr);

  // Deploy NFT staking contract
  const rewardPerSecond = hre.ethers.parseUnits("1", 18);
  const NFTStaking = await hre.ethers.getContractFactory("NFTStaking");
  const nftStaking = await NFTStaking.deploy(nftAddr, rewardTokenAddr, rewardPerSecond);
  await nftStaking.waitForDeployment();
  const nftStakingAddr = await nftStaking.getAddress();
  console.log("NFTStaking:", nftStakingAddr);

  // Fund reward pools
  const fundAmount = hre.ethers.parseUnits("100000", 18);
  let tx;

  tx = await rewardToken.approve(stakingAddr, fundAmount);
  await tx.wait();
  tx = await staking.fundRewards(fundAmount);
  await tx.wait();

  tx = await rewardToken.approve(nftStakingAddr, fundAmount);
  await tx.wait();
  tx = await nftStaking.fundRewards(fundAmount);
  await tx.wait();

  console.log("Rewards funded.");

  // Save deployment addresses for later verification
  const network = hre.network.name;
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const existing = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))
    : {};
  const next = {
    ...existing,
    [network]: {
      WTC: rewardTokenAddr,
      StakeToken: stakingTokenAddr,
      MyNFT: nftAddr,
      StakingContract: stakingAddr,
      NFTStaking: nftStakingAddr,
      rewardRate: rewardRate.toString(),
      rewardPerSecond: rewardPerSecond.toString(),
    },
  };
  fs.writeFileSync(deploymentsPath, JSON.stringify(next, null, 2));
  console.log("Saved deployments to deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
