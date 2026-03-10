require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require('@openzeppelin/hardhat-upgrades');

// require("@nomiclabs/hardhat-ethers");
// require("@nomiclabs/hardhat-etherscan");

require("dotenv").config();

const sharedAccounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: sharedAccounts,
      chainId: 11155111,
    },
    eth: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: sharedAccounts,
      chainId: 1,
    },
    bnb: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: sharedAccounts,
      chainId: 56,
      gasPrice: 1000000000,

    },
    arb: {
      url: process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: sharedAccounts,
      chainId: 421614,
    },
    polygon: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: sharedAccounts,
      chainId: 137,
    },
    arbitrumOne: {
      url: process.env.ARB_MAINNET_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: sharedAccounts,
      chainId: 42161,
      gasPrice: 1000000000, 
    },
    arbMainnet: {
      url: "https://arb-mainnet.g.alchemy.com/v2/3OCmC3oXcz--QdnSObb5_VHNUUKOpnQ-",
      accounts: sharedAccounts,
      chainId: 42161,
      gasPrice: 10000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      // For local testing
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: "0.7.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      bnb: process.env.ARBISCAN_API_KEY,
      base: process.env.ARBISCAN_API_KEY,
      avax: process.env.ARBISCAN_API_KEY,
      eth: process.env.ARBISCAN_API_KEY,
      polygon: process.env.ARBISCAN_API_KEY,
      arbitrumSepolia: process.env.ARBISCAN_API_KEY,
      arb: process.env.ARBISCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      arbMainnet: process.env.ARBISCAN_API_KEY,
    },
    customChains: [
      {
        network: "eth",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=1",
          browserURL: "https://etherscan.io/",
        },
      },
      {
        network: "bnb",
        chainId: 56,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=56",
          browserURL: "https://bscscan.io/",
        },
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=137",
          browserURL: "https://polygonscan.io/",
        },
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=421614",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "arb",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=421614",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      // Arbitrum One (Mainnet)
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=42161",
          browserURL: "https://arbiscan.io/",
        },
      },
      {
        network: "arbMainnet",
        chainId: 42161,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=42161",
          browserURL: "https://arbiscan.io/",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};
