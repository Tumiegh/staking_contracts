const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. Run deploy first.");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const d = deployments[network];
  if (!d) {
    throw new Error(`No deployments for network: ${network}`);
  }

  const tasks = [
    {
      name: "WTC",
      address: d.WTC,
      args: ["Workshop Token", "WTC", 1000000],
    },
    {
      name: "StakeToken",
      address: d.StakeToken,
      args: ["Stake Token", "STK", 1000000],
    },
    {
      name: "MyNFT",
      address: d.MyNFT,
      args: ["Workshop NFT", "WNFT", "ipfs://workshop/"],
    },
    {
      name: "StakingContract",
      address: d.StakingContract,
      args: [d.StakeToken, d.WTC, d.rewardRate],
    },
    {
      name: "NFTStaking",
      address: d.NFTStaking,
      args: [d.MyNFT, d.WTC, d.rewardPerSecond],
    },
  ];

  for (const t of tasks) {
    try {
      console.log(`Verifying ${t.name}: ${t.address}`);
      await hre.run("verify:verify", {
        address: t.address,
        constructorArguments: t.args,
      });
    } catch (err) {
      const msg = (err && err.message) || String(err);
      console.log(`Skip ${t.name}: ${msg}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
