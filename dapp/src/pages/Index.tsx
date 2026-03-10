import DAppHeader from "@/components/DAppHeader";
import TokenStaking from "@/components/TokenStaking";
import NFTStaking from "@/components/NFTStaking";
import ActivityLog from "@/components/ActivityLog";
import StakingJourney from "@/components/StakingJourney";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <DAppHeader />

      <main className="container py-8 space-y-6">
        <StakingJourney />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TokenStaking />
          <NFTStaking />
        </div>

        <ActivityLog />
      </main>

      <footer className="border-t border-muted py-6">
        <div className="container flex items-center justify-between">
          <span className="font-heading text-[10px] tracking-widest text-muted-foreground">
            VAULT.STAKE PROTOCOL — ALL RIGHTS RESERVED
          </span>
          <span className="font-heading text-[10px] tracking-widest text-muted-foreground">
            V1.0.0
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
