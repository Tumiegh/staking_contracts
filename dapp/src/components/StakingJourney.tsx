const steps = [
  { step: 1, label: "ACQUIRE", desc: "Buy or mint tokens & NFTs" },
  { step: 2, label: "APPROVE", desc: "Authorize the staking contract" },
  { step: 3, label: "STAKE", desc: "Lock your assets in the vault" },
  { step: 4, label: "EARN", desc: "Watch rewards accumulate" },
  { step: 5, label: "CLAIM", desc: "Withdraw rewards or unstake" },
];

const StakingJourney = () => {
  return (
    <div className="bg-card text-card-foreground p-8">
      <h2 className="font-heading text-sm font-bold tracking-widest mb-8">STAKING JOURNEY</h2>
      <div className="flex flex-col sm:flex-row sm:items-start gap-0">
        {steps.map((s, i) => (
          <div key={s.step} className="flex sm:flex-col items-center sm:items-center flex-1 relative">
            {i < steps.length - 1 && (
              <>
                <div className="hidden sm:block absolute top-4 left-1/2 w-full h-px bg-rebar/40" />
                <div className="sm:hidden absolute left-4 top-8 w-px h-full bg-rebar/40" />
              </>
            )}
            <div className="w-8 h-8 flex items-center justify-center border border-rebar font-heading text-xs font-bold relative z-10 bg-card">
              {s.step}
            </div>
            <div className="ml-4 sm:ml-0 sm:mt-3 sm:text-center">
              <p className="font-heading text-xs font-bold tracking-widest">{s.label}</p>
              <p className="font-body text-[11px] text-rebar mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StakingJourney;
