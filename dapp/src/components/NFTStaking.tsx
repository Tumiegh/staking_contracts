import { useEffect, useMemo, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { useWeb3 } from "@/hooks/useWeb3";
import { ABIS, CONTRACTS } from "@/lib/contracts";

interface NFTItem {
  id: number;
  name: string;
  status: "owned" | "staked" | "unknown";
}

const defaultTracked: NFTItem[] = [
  { id: 1, name: "STAR #0001", status: "unknown" },
  { id: 2, name: "STAR #0002", status: "unknown" },
];

const NFTStaking = () => {
  const [nfts, setNfts] = useState(defaultTracked);
  const [pendingRewards, setPendingRewards] = useState("0");
  const [rewardSymbol, setRewardSymbol] = useState("WTC");
  const [animatingId, setAnimatingId] = useState<number | null>(null);
  const [trackInput, setTrackInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { account, signer, readProvider, isSepolia } = useWeb3();

  const nftRead = useMemo(
    () => new Contract(CONTRACTS.MyNFT, ABIS.MyNFT, readProvider),
    [readProvider]
  );
  const nftWrite = useMemo(
    () => (signer ? new Contract(CONTRACTS.MyNFT, ABIS.MyNFT, signer) : null),
    [signer]
  );
  const stakingRead = useMemo(
    () => new Contract(CONTRACTS.NFTStaking, ABIS.NFTStaking, readProvider),
    [readProvider]
  );
  const stakingWrite = useMemo(
    () => (signer ? new Contract(CONTRACTS.NFTStaking, ABIS.NFTStaking, signer) : null),
    [signer]
  );
  const rewardTokenRead = useMemo(
    () => new Contract(CONTRACTS.WTC, ABIS.WTC, readProvider),
    [readProvider]
  );

  const stakedIds = useMemo(
    () => nfts.filter((n) => n.status === "staked").map((n) => n.id),
    [nfts]
  );
  const stakedCount = stakedIds.length;
  const ownedCount = nfts.filter((n) => n.status === "owned").length;

  const refresh = async () => {
    if (!account) return;
    const updates = await Promise.all(
      nfts.map(async (n) => {
        const position = await stakingRead.positionOf(n.id);
        if (position?.owner && position.owner.toLowerCase() === account.toLowerCase()) {
          return { ...n, status: "staked" as const };
        }
        try {
          const owner = await nftRead.ownerOf(n.id);
          if (owner.toLowerCase() === account.toLowerCase()) {
            return { ...n, status: "owned" as const };
          }
        } catch {
          // ignore nonexistent token
        }
        return { ...n, status: "unknown" as const };
      })
    );
    setNfts(updates);
    const stakedNow = updates.filter((n) => n.status === "staked").map((n) => n.id);

    if (stakedNow.length > 0) {
      const reward = await stakingRead.pendingRewards(account, stakedNow);
      setPendingRewards(formatUnits(reward, 18));
      const sym = await rewardTokenRead.symbol();
      setRewardSymbol(sym);
    } else {
      setPendingRewards("0");
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 12000);
    return () => clearInterval(t);
  }, [account]);

  const ensureApproval = async () => {
    if (!nftWrite || !account) return;
    const approved = await nftRead.isApprovedForAll(account, CONTRACTS.NFTStaking);
    if (!approved) {
      const tx = await nftWrite.setApprovalForAll(CONTRACTS.NFTStaking, true);
      await tx.wait();
    }
  };

  const handleToggle = async (id: number) => {
    if (!stakingWrite || !account || !isSepolia) return;
    setAnimatingId(id);
    setBusy(true);
    setError(null);
    try {
      const current = nfts.find((n) => n.id === id);
      if (!current || current.status === "unknown") return;

      if (current.status === "staked") {
        const tx = await stakingWrite.unstake([id]);
        await tx.wait();
      } else {
        await ensureApproval();
        const tx = await stakingWrite.stake([id]);
        await tx.wait();
      }
      await refresh();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "NFT stake failed");
    } finally {
      setAnimatingId(null);
      setBusy(false);
    }
  };

  const handleTrack = () => {
    if (!trackInput.trim()) return;
    const ids = trackInput
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    const next = [...nfts];
    ids.forEach((id) => {
      if (!next.some((n) => n.id === id)) {
        next.push({ id, name: `STAR #${String(id).padStart(4, "0")}`, status: "unknown" });
      }
    });
    setNfts(next);
    setTrackInput("");
  };

  const handleClaimAll = async () => {
    if (!stakingWrite || !account || !isSepolia || stakedIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await stakingWrite.claimRewards(stakedIds);
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground p-8">
      <h2 className="font-heading text-sm font-bold tracking-widest mb-8">NFT STAKING</h2>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">STAKED</span>
          <span className="font-heading text-2xl font-bold">{stakedCount} NFTs</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">OWNED</span>
          <span className="font-heading text-2xl font-bold">{ownedCount} NFTs</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">PENDING REWARDS</span>
          <span className="font-heading text-2xl font-bold text-molten">
            {Number(pendingRewards).toFixed(3)} {rewardSymbol}
          </span>
        </div>
      </div>

      {!account && (
        <div className="text-xs text-rebar mb-4">
          Connect your wallet to track and stake NFTs.
        </div>
      )}
      {account && !isSepolia && (
        <div className="text-xs text-rebar mb-4">Switch to Sepolia to use NFT staking.</div>
      )}
      {error && <div className="text-xs text-red-400 mb-4">{error}</div>}

      <div className="mb-6">
        <div className="border border-rebar flex">
          <input
            type="text"
            value={trackInput}
            onChange={(e) => setTrackInput(e.target.value)}
            placeholder="Track token IDs (e.g. 1,2,47)"
            className="flex-1 bg-transparent px-4 py-3 font-heading text-sm outline-none placeholder:text-rebar"
          />
          <button
            onClick={handleTrack}
            className="px-4 font-heading text-[10px] tracking-widest text-rebar hover:text-card-foreground transition-colors border-l border-rebar"
          >
            ADD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {nfts.map((nft) => {
          const isUnknown = nft.status === "unknown";
          const isStaked = nft.status === "staked";
          const statusLabel = isStaked ? "STAKED" : isUnknown ? "UNKNOWN" : "OWNED";
          const hintLabel = isStaked
            ? "CLICK TO UNSTAKE"
            : isUnknown
              ? "NOT YOUR NFT"
              : "CLICK TO STAKE";

          return (
            <button
              key={nft.id}
              onClick={() => handleToggle(nft.id)}
              disabled={busy || !account || !isSepolia || isUnknown}
              className={`relative p-4 border transition-all duration-200 text-left ${
                animatingId === nft.id ? "animate-slot-in" : ""
              } ${
                isStaked
                  ? "border-molten bg-void text-foreground"
                  : "border-rebar hover:border-card-foreground"
              } ${isUnknown ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <p className="font-heading text-xs font-bold">{nft.name}</p>
              <p
                className={`font-heading text-[10px] tracking-widest mt-1 ${
                  isStaked ? "text-molten" : "text-rebar"
                }`}
              >
                {statusLabel}
              </p>
              <p className="font-body text-[10px] text-rebar mt-2">{hintLabel}</p>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleClaimAll}
        disabled={busy || !account || !isSepolia || stakedIds.length === 0}
        className="w-full py-3.5 font-heading text-xs tracking-widest bg-molten text-primary-foreground hover:bg-molten/80 transition-colors disabled:opacity-50"
      >
        CLAIM ALL REWARDS
      </button>
    </div>
  );
};

export default NFTStaking;
