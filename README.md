# Vault.Stake

Vault.Stake is a staking platform that lets users lock a fungible staking token (STK) and stake NFTs to earn rewards in a reward token (WTC). It combines two flows in one dapp:

- Token staking with a time lock (30 days) and continuous reward accrual.
- NFT staking with per‑second rewards and claimable payouts.

## Why Vault.Stake is beneficial

Vault.Stake helps users earn predictable, on‑chain rewards by committing their assets for a period of time. It also gives project teams a structured way to distribute rewards and encourage long‑term participation without relying on off‑chain accounting.

## Advantages

- Transparent reward math on‑chain.
- Users can claim rewards without withdrawing principal.
- NFT staking supports one‑by‑one tracking and flexible claims.
- Time lock prevents short‑term farming and stabilizes liquidity.
- All actions are verifiable on a block explorer.

## Project structure

- `contracts/ai.sol` — ERC‑20 token staking contract (30‑day lock).
- `contracts/NFTStaking.sol` — NFT staking contract with per‑second rewards.
- `contracts/token.sol` — ERC‑20 token (WTC).
- `contracts/MyNFT.sol` — ERC‑721 NFT collection.
- `dapp/` — Frontend connected to Sepolia.

## Quick start (local)

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deploy (Sepolia)

```bash
npx hardhat run script/deploy.js --network sepolia
```

Deployed addresses are stored in `deployments.json`.

## Dapp

```bash
cd dapp
npm install
npm run dev
```

## Terminal commands (balances, stakes, rewards)

Run all of these from the project root:

```bash
npx hardhat console --network sepolia
```

Replace `WALLET` with your wallet address.

### Token balances (STK and WTC)

```js
const WALLET = "0xYourWallet";

const stk = await ethers.getContractAt("WTC", "<StakeToken address>");
const wtc = await ethers.getContractAt("WTC", "<WTC address>");

const stkBal = await stk.balanceOf(WALLET);
const wtcBal = await wtc.balanceOf(WALLET);

ethers.formatUnits(stkBal, 18)
etheres.formatUnits(wtcBal, 18)
```

### Token staking status and rewards

```js
const WALLET = "0xYourWallet";

const staking = await ethers.getContractAt("StakingContract", "<StakingContract address>");

const staked = await staking.stakedBalance(WALLET);
const earned = await staking.earned(WALLET);
const lockSeconds = await staking.stakingDuration();
const stakedAt = await staking.stakingTimestamp(WALLET);

ethers.formatUnits(staked, 18)
ethers.formatUnits(earned, 18)
Number(lockSeconds) / 86400 // days
Number(stakedAt)
```

### NFT balances

```js
const WALLET = "0xYourWallet";

const nft = await ethers.getContractAt("MyNFT", "<MyNFT address>");
const nftBalance = await nft.balanceOf(WALLET);

nftBalance.toString()
```

### NFT staking status and rewards

```js
const WALLET = "0xYourWallet";

const nftStaking = await ethers.getContractAt("NFTStaking", "<NFTStaking address>");

// example for token IDs 1 and 2
const pending = await nftStaking.pendingRewards(WALLET, [1, 2]);
ethers.formatUnits(pending, 18)
```

## Notes

- Token staking rewards accrue immediately after staking.
- Withdrawals are locked for 30 days.
- Emergency withdraw returns staked tokens without rewards.
