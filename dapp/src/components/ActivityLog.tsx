import { useEffect, useMemo, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { useWeb3 } from "@/hooks/useWeb3";
import { ABIS, CONTRACTS } from "@/lib/contracts";

type ActivityItem = {
  type: string;
  asset: string;
  time: string;
  hash: string;
  blockNumber: number;
  logIndex: number;
};

const formatAgo = (ts: number) => {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ActivityLog = () => {
  const { account, readProvider } = useWeb3();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  const staking = useMemo(
    () => new Contract(CONTRACTS.StakingContract, ABIS.StakingContract, readProvider),
    [readProvider]
  );
  const nftStaking = useMemo(
    () => new Contract(CONTRACTS.NFTStaking, ABIS.NFTStaking, readProvider),
    [readProvider]
  );
  const stakeToken = useMemo(
    () => new Contract(CONTRACTS.StakeToken, ABIS.WTC, readProvider),
    [readProvider]
  );
  const rewardToken = useMemo(
    () => new Contract(CONTRACTS.WTC, ABIS.WTC, readProvider),
    [readProvider]
  );

  useEffect(() => {
    if (!account) {
      setItems([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [latest, stakeSym, rewardSym, stakeDec] = await Promise.all([
          readProvider.getBlockNumber(),
          stakeToken.symbol(),
          rewardToken.symbol(),
          stakeToken.decimals(),
        ]);
        const fromBlock = Math.max(0, latest - 50_000);

        const [staked, withdrawn, paid, nftStaked, nftUnstaked, nftPaid] = await Promise.all([
          staking.queryFilter(staking.filters.Staked(account, null), fromBlock, latest),
          staking.queryFilter(staking.filters.Withdrawn(account, null), fromBlock, latest),
          staking.queryFilter(staking.filters.RewardPaid(account, null), fromBlock, latest),
          nftStaking.queryFilter(nftStaking.filters.Staked(account, null), fromBlock, latest),
          nftStaking.queryFilter(nftStaking.filters.Unstaked(account, null), fromBlock, latest),
          nftStaking.queryFilter(nftStaking.filters.RewardsClaimed(account, null), fromBlock, latest),
        ]);

        const all = [
          ...staked.map((log) => ({
            type: "STAKE",
            asset: `${formatUnits(log.args?.amount ?? 0n, stakeDec)} ${stakeSym}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
          ...withdrawn.map((log) => ({
            type: "WITHDRAW",
            asset: `${formatUnits(log.args?.amount ?? 0n, stakeDec)} ${stakeSym}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
          ...paid.map((log) => ({
            type: "CLAIM",
            asset: `${formatUnits(log.args?.reward ?? 0n, stakeDec)} ${rewardSym}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
          ...nftStaked.map((log) => ({
            type: "STAKE NFT",
            asset: `STAR #${Number(log.args?.tokenId ?? 0)}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
          ...nftUnstaked.map((log) => ({
            type: "UNSTAKE NFT",
            asset: `STAR #${Number(log.args?.tokenId ?? 0)}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
          ...nftPaid.map((log) => ({
            type: "CLAIM",
            asset: `${formatUnits(log.args?.amount ?? 0n, stakeDec)} ${rewardSym}`,
            hash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.index,
          })),
        ];

        const blocks = new Map<number, number>();
        for (const item of all) {
          if (!blocks.has(item.blockNumber)) {
            const b = await readProvider.getBlock(item.blockNumber);
            blocks.set(item.blockNumber, Number(b?.timestamp ?? 0));
          }
        }

        const enriched: ActivityItem[] = all
          .map((item) => ({
            ...item,
            time: formatAgo(blocks.get(item.blockNumber) ?? 0),
          }))
          .sort((a, b) => (b.blockNumber - a.blockNumber) || (b.logIndex - a.logIndex));

        if (!cancelled) setItems(enriched);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [account, readProvider]);

  return (
    <div className="bg-card text-card-foreground p-8">
      <h2 className="font-heading text-sm font-bold tracking-widest mb-6">ACTIVITY LOG</h2>
      {!account && <div className="text-xs text-rebar">Connect your wallet to see activity.</div>}
      {account && loading && items.length === 0 && (
        <div className="text-xs text-rebar">Loading recent activity...</div>
      )}
      {account && !loading && items.length === 0 && (
        <div className="text-xs text-rebar">No activity yet.</div>
      )}
      <div className="space-y-0">
        {items.map((activity) => (
          <div
            key={`${activity.hash}-${activity.logIndex}`}
            className="flex items-center justify-between py-3 border-b border-rebar/30 last:border-b-0"
          >
            <div className="flex items-center gap-4">
              <span
                className={`font-heading text-[10px] tracking-widest w-24 ${
                  activity.type.includes("STAKE") && !activity.type.includes("UNSTAKE")
                    ? "text-molten"
                    : "text-card-foreground"
                }`}
              >
                {activity.type}
              </span>
              <span className="font-heading text-xs">{activity.asset}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-body text-xs text-rebar">{activity.time}</span>
              <span className="font-heading text-[10px] text-rebar hidden sm:inline">
                {activity.hash.slice(0, 6)}...{activity.hash.slice(-4)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
