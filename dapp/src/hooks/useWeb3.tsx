import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { CHAIN_ID, CHAIN_NAME, RPC_URL } from "@/lib/contracts";

type Web3ContextValue = {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  readProvider: JsonRpcProvider | BrowserProvider;
  connect: () => Promise<void>;
  disconnect: () => void;
  hasProvider: boolean;
  isSepolia: boolean;
  connecting: boolean;
};

const Web3Context = createContext<Web3ContextValue | null>(null);

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fallbackProvider = useMemo(() => new JsonRpcProvider(RPC_URL), []);
  const hasProvider = typeof window !== "undefined" && !!(window as any).ethereum;
  const isSepolia = chainId === CHAIN_ID;

  const connect = async () => {
    if (!hasProvider) return;
    setConnecting(true);
    try {
      const eth = (window as any).ethereum;
      const p = new BrowserProvider(eth);
      await p.send("eth_requestAccounts", []);
      const network = await p.getNetwork();

      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await p.send("wallet_switchEthereumChain", [
            { chainId: "0x" + CHAIN_ID.toString(16) },
          ]);
        } catch (err: any) {
          if (err?.code === 4902) {
            await p.send("wallet_addEthereumChain", [
              {
                chainId: "0x" + CHAIN_ID.toString(16),
                chainName: CHAIN_NAME,
                rpcUrls: [RPC_URL],
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ]);
          } else {
            throw err;
          }
        }
      }

      const s = await p.getSigner();
      const addr = await s.getAddress();
      const net = await p.getNetwork();

      setProvider(p);
      setSigner(s);
      setAccount(addr);
      setChainId(Number(net.chainId));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
  };

  useEffect(() => {
    if (!hasProvider) return;
    const eth = (window as any).ethereum;

    const syncFromWallet = async () => {
      const p = new BrowserProvider(eth);
      const net = await p.getNetwork();
      const accounts = await p.send("eth_accounts", []);
      if (!accounts || accounts.length === 0) return;
      const s = await p.getSigner();
      const addr = await s.getAddress();
      setProvider(p);
      setSigner(s);
      setAccount(addr);
      setChainId(Number(net.chainId));
    };

    const onAccounts = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setProvider(null);
        setSigner(null);
        setAccount(null);
        return;
      }
      syncFromWallet();
    };

    const onChain = (id: string) => setChainId(Number(id));

    syncFromWallet();

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [hasProvider]);

  const value: Web3ContextValue = {
    account,
    chainId,
    provider,
    signer,
    readProvider: provider ?? fallbackProvider,
    connect,
    disconnect,
    hasProvider,
    isSepolia,
    connecting,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider");
  return ctx;
};
