import WTC from "@/abi/WTC.json";
import MyNFT from "@/abi/MyNFT.json";
import StakingContract from "@/abi/StakingContract.json";
import NFTStaking from "@/abi/NFTStaking.json";

export const CHAIN_ID = 11155111;
export const CHAIN_NAME = "Sepolia";
export const RPC_URL = "https://rpc.sepolia.org";

export const CONTRACTS = {
  WTC: "0x365993B6B3C9D5b4381F23d16882845102925e61",
  StakeToken: "0x0CB1E2f0b5c2a3032f68A7f3515298cA85Bb158c",
  MyNFT: "0x7D1aB28c59a151DD0bc77a6B841F28FBBF283512",
  StakingContract: "0xcc311c1A33c1327Fa96a8EAeFccC51202890c5ec",
  NFTStaking: "0xe5aF7984009c9a6C555760AB68de06E247111Ba6",
} as const;

export const ABIS = {
  WTC: WTC.abi,
  MyNFT: MyNFT.abi,
  StakingContract: StakingContract.abi,
  NFTStaking: NFTStaking.abi,
} as const;
