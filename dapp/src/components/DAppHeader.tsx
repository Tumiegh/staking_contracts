import { useEffect, useMemo, useState } from "react";
import { Contract } from "ethers";
import { useWeb3 } from "@/hooks/useWeb3";
import { ABIS, CHAIN_NAME, CONTRACTS } from "@/lib/contracts";

const DAppHeader = () => {
  const { account, connect, disconnect, isSepolia, connecting, readProvider } = useWeb3();
  const shortAddress = useMemo(() => {
    if (!account) return "";
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);
  const [stakeSymbol, setStakeSymbol] = useState("STK");

  useEffect(() => {
    const token = new Contract(CONTRACTS.StakeToken, ABIS.WTC, readProvider);
    token
      .symbol()
      .then((s: string) => setStakeSymbol(s))
      .catch(() => setStakeSymbol("STK"));
  }, [readProvider]);

  return (
    <header className="sticky top-0 z-50 border-b border-muted bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
            VAULT<span className="text-primary">.</span>STAKE
          </h1>
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isSepolia ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="font-heading text-xs text-muted-foreground">
              {CHAIN_NAME} {isSepolia ? "TESTNET" : "WRONG NETWORK"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="font-heading text-[10px] text-muted-foreground">TOKEN CONTRACT</p>
            <p className="font-heading text-xs text-muted-foreground">
              {stakeSymbol} · {`${CONTRACTS.StakeToken.slice(0, 6)}...${CONTRACTS.StakeToken.slice(-4)}`}
            </p>
          </div>
          <button
            onClick={account ? disconnect : connect}
            disabled={connecting}
            className={`font-heading text-xs tracking-widest px-6 py-2.5 transition-colors ${
              account
                ? "border border-rebar text-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground hover:bg-primary/80"
            }`}
          >
            {account ? shortAddress : connecting ? "CONNECTING..." : "CONNECT WALLET"}
          </button>
        </div>
      </div>
    </header>
  );
};

export default DAppHeader;
