import { useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useWeb3 } from "@/hooks/useWeb3";
import { ABIS, CONTRACTS } from "@/lib/contracts";

const TokenStaking = () => {
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakedBalance, setStakedBalance] = useState("0");
  const [pendingRewards, setPendingRewards] = useState("0");
  const [lockTimePercent, setLockTimePercent] = useState(0);
  const [walletBalance, setWalletBalance] = useState("0");
  const [walletBalanceRaw, setWalletBalanceRaw] = useState<bigint>(0n);
  const [decimals, setDecimals] = useState(18);
  const [durationDays, setDurationDays] = useState(30);
  const [stakeSymbol, setStakeSymbol] = useState("STK");
  const [rewardSymbol, setRewardSymbol] = useState("WTC");
  const [busy, setBusy] = useState(false);
  const [buttonState, setButtonState] = useState<"idle" | "pending" | "confirmed">("idle");
  const [error, setError] = useState<string | null>(null);

  const { account, signer, readProvider, isSepolia } = useWeb3();

  const stakingRead = useMemo(
    () => new Contract(CONTRACTS.StakingContract, ABIS.StakingContract, readProvider),
    [readProvider]
  );
  const stakingWrite = useMemo(
    () => (signer ? new Contract(CONTRACTS.StakingContract, ABIS.StakingContract, signer) : null),
    [signer]
  );
  const stakeTokenRead = useMemo(
    () => new Contract(CONTRACTS.StakeToken, ABIS.WTC, readProvider),
    [readProvider]
  );
  const stakeTokenWrite = useMemo(
    () => (signer ? new Contract(CONTRACTS.StakeToken, ABIS.WTC, signer) : null),
    [signer]
  );
  const rewardTokenRead = useMemo(
    () => new Contract(CONTRACTS.WTC, ABIS.WTC, readProvider),
    [readProvider]
  );

  const handleStake = () => {
    if (!stakeAmount || !stakingWrite || !stakeTokenWrite || !account) return;
    (async () => {
      setBusy(true);
      setButtonState("pending");
      setError(null);
      try {
        const amount = parseUnits(stakeAmount, decimals);
        const allowance = await stakeTokenRead.allowance(account, CONTRACTS.StakingContract);
        if (allowance < amount) {
          const tx = await stakeTokenWrite.approve(CONTRACTS.StakingContract, amount);
          await tx.wait();
        }
        const tx = await stakingWrite.stake(amount);
        await tx.wait();
        setStakeAmount("");
        setButtonState("confirmed");
        await refresh();
      } catch (err: any) {
        setError(err?.shortMessage || err?.message || "Stake failed");
      } finally {
        setBusy(false);
        setTimeout(() => setButtonState("idle"), 1500);
      }
    })();
  };

  const handleWithdrawAll = async () => {
    if (!stakingWrite || !account) return;
    setBusy(true);
    setError(null);
    try {
      const amount = await stakingRead.stakedBalance(account);
      if (amount === 0n) return;
      const tx = await stakingWrite.withdraw(amount);
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    if (!stakingWrite) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await stakingWrite.getReward();
      await tx.wait();
      await refresh();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!account) return;
    const [dec, bal, staked, pending, ts, dur, stakeSym, rewardSym] = await Promise.all([
      stakeTokenRead.decimals(),
      stakeTokenRead.balanceOf(account),
      stakingRead.stakedBalance(account),
      stakingRead.earned(account),
      stakingRead.stakingTimestamp(account),
      stakingRead.stakingDuration(),
      stakeTokenRead.symbol(),
      rewardTokenRead.symbol(),
    ]);

    setDecimals(Number(dec));
    setWalletBalance(formatUnits(bal, dec));
    setWalletBalanceRaw(bal);
    setStakedBalance(formatUnits(staked, dec));
    setPendingRewards(formatUnits(pending, dec));
    setStakeSymbol(stakeSym);
    setRewardSymbol(rewardSym);
    const days = Math.max(1, Math.round(Number(dur) / 86400));
    setDurationDays(days);

    if (staked > 0n && ts > 0n) {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, now - Number(ts));
      const percent = Math.min(100, Math.floor((elapsed / Number(dur)) * 100));
      setLockTimePercent(percent);
    } else {
      setLockTimePercent(0);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [account]);

  return (
    <div className="bg-card text-card-foreground p-8">
      <h2 className="font-heading text-sm font-bold tracking-widest mb-8">TOKEN STAKING</h2>

      <div className="space-y-4 mb-8">
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">STAKED BALANCE</span>
          <span className="font-heading text-2xl font-bold">
            {Number(stakedBalance).toLocaleString()} {stakeSymbol}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">PENDING REWARDS</span>
          <span className="font-heading text-2xl font-bold text-molten">
            {Number(pendingRewards).toFixed(3)} {rewardSymbol}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-body text-sm text-rebar">WALLET BALANCE</span>
          <span className="font-heading text-2xl font-bold">
            {Number(walletBalance).toLocaleString()} {stakeSymbol}
          </span>
        </div>

        {!account && (
          <div className="text-xs text-rebar">
            Connect your wallet to stake and claim rewards.
          </div>
        )}
        {account && !isSepolia && (
          <div className="text-xs text-rebar">
            Switch to Sepolia to use staking actions.
          </div>
        )}
        {account && walletBalanceRaw === 0n && (
          <div className="text-xs text-rebar">
            You have 0 STK. Ask the deployer to transfer stake tokens to your wallet.
          </div>
        )}
        {error && <div className="text-xs text-red-400">{error}</div>}

        <div>
          <div className="flex justify-between mb-2">
            <span className="font-body text-xs text-rebar">LOCK TIME</span>
            <span className="font-heading text-xs">{lockTimePercent}%</span>
          </div>
          <div className="h-1 w-full bg-void">
            <div
              className="h-1 bg-molten transition-all duration-1000"
              style={{ width: `${lockTimePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-body text-[10px] text-rebar">DAY 0</span>
            <span className="font-body text-[10px] text-rebar">DAY {durationDays}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="border border-rebar flex">
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent px-4 py-3 font-heading text-sm outline-none placeholder:text-rebar"
          />
          <button
            onClick={() => setStakeAmount(walletBalance)}
            className="px-4 font-heading text-[10px] tracking-widest text-rebar hover:text-card-foreground transition-colors border-l border-rebar"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleStake}
          disabled={buttonState === "pending" || busy || !account || !isSepolia || walletBalanceRaw === 0n}
          className="w-full py-3.5 font-heading text-xs tracking-widest bg-molten text-primary-foreground hover:bg-molten/80 transition-colors disabled:opacity-50"
        >
          {buttonState === "idle" && "STAKE"}
          {buttonState === "pending" && "PENDING..."}
          {buttonState === "confirmed" && "CONFIRMED"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleWithdrawAll}
            disabled={busy || !account || !isSepolia}
            className="py-3 font-heading text-xs tracking-widest border border-rebar text-card-foreground hover:bg-rebar/10 transition-colors disabled:opacity-50"
          >
            WITHDRAW
          </button>
          <button
            onClick={handleClaim}
            disabled={busy || !account || !isSepolia}
            className="py-3 font-heading text-xs tracking-widest border border-rebar text-card-foreground hover:bg-rebar/10 transition-colors disabled:opacity-50"
          >
            CLAIM
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenStaking;
