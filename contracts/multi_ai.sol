// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TieredStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct StakingTier {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 rewardMultiplier; // In basis points (10000 = 100%)
        uint256 lockDuration;
        bool isActive;
    }

    struct StakeInfo {
        uint256 amount;
        uint256 tierId;
        uint256 stakedAt;
        uint256 lastClaimed;
        uint256 pendingRewards;
    }

    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    uint256 public baseRewardRate; // Tokens per second per token staked
    uint256 public totalStaked;
    
    mapping(uint256 => StakingTier) public tiers;
    uint256 public tierCount;
    
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public totalUserStaked;

    event Staked(address indexed user, uint256 amount, uint256 tierId, uint256 stakeIndex);
    event Withdrawn(address indexed user, uint256 amount, uint256 stakeIndex);
    event RewardClaimed(address indexed user, uint256 amount, uint256 stakeIndex);
    event TierCreated(uint256 indexed tierId, uint256 minAmount, uint256 maxAmount, uint256 multiplier, uint256 lockDuration);
    event TierUpdated(uint256 indexed tierId, bool isActive);

    constructor(address _stakingToken, address _rewardToken, uint256 _baseRewardRate) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        baseRewardRate = _baseRewardRate;
    }

    // Create a new staking tier
    function createTier(
        uint256 minAmount,
        uint256 maxAmount,
        uint256 rewardMultiplier,
        uint256 lockDuration
    ) external onlyOwner {
        require(minAmount < maxAmount, "Invalid amounts");
        require(rewardMultiplier > 0, "Invalid multiplier");
        
        tierCount++;
        tiers[tierCount] = StakingTier({
            minAmount: minAmount,
            maxAmount: maxAmount,
            rewardMultiplier: rewardMultiplier,
            lockDuration: lockDuration,
            isActive: true
        });
        
        emit TierCreated(tierCount, minAmount, maxAmount, rewardMultiplier, lockDuration);
    }

    // Update tier status
    function setTierStatus(uint256 tierId, bool isActive) external onlyOwner {
        require(tierId > 0 && tierId <= tierCount, "Invalid tier");
        tiers[tierId].isActive = isActive;
        emit TierUpdated(tierId, isActive);
    }

    // Stake tokens in a specific tier
    function stake(uint256 amount, uint256 tierId) external nonReentrant {
        require(tierId > 0 && tierId <= tierCount, "Invalid tier");
        StakingTier memory tier = tiers[tierId];
        require(tier.isActive, "Tier not active");
        require(amount >= tier.minAmount && amount <= tier.maxAmount, "Amount not in tier range");
        require(amount > 0, "Cannot stake 0");

        // Calculate if user has capacity in this tier
        uint256 userTierTotal = 0;
        for (uint i = 0; i < userStakes[msg.sender].length; i++) {
            if (userStakes[msg.sender][i].tierId == tierId) {
                userTierTotal += userStakes[msg.sender][i].amount;
            }
        }
        require(userTierTotal + amount <= tier.maxAmount, "Exceeds tier max");

        // Create new stake
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            tierId: tierId,
            stakedAt: block.timestamp,
            lastClaimed: block.timestamp,
            pendingRewards: 0
        }));

        totalUserStaked[msg.sender] += amount;
        totalStaked += amount;
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Staked(msg.sender, amount, tierId, userStakes[msg.sender].length - 1);
    }

    // Calculate rewards for a specific stake
    function calculateRewards(address user, uint256 stakeIndex) public view returns (uint256) {
        StakeInfo memory stake = userStakes[user][stakeIndex];
        StakingTier memory tier = tiers[stake.tierId];
        
        uint256 timeStaked = block.timestamp - stake.lastClaimed;
        uint256 baseReward = stake.amount * baseRewardRate * timeStaked / 1e18;
        uint256 multipliedReward = baseReward * tier.rewardMultiplier / 10000;
        
        return multipliedReward + stake.pendingRewards;
    }

    // Claim rewards for a specific stake
    function claimRewards(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake");
        
        uint256 reward = calculateRewards(msg.sender, stakeIndex);
        require(reward > 0, "No rewards to claim");
        
        userStakes[msg.sender][stakeIndex].lastClaimed = block.timestamp;
        userStakes[msg.sender][stakeIndex].pendingRewards = 0;
        
        rewardToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward, stakeIndex);
    }

    // Withdraw a specific stake
    function withdrawStake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake");
        
        StakeInfo memory stake = userStakes[msg.sender][stakeIndex];
        StakingTier memory tier = tiers[stake.tierId];
        
        require(block.timestamp >= stake.stakedAt + tier.lockDuration, "Stake still locked");
        
        // Calculate and pay pending rewards
        uint256 rewards = calculateRewards(msg.sender, stakeIndex);
        if (rewards > 0) {
            rewardToken.safeTransfer(msg.sender, rewards);
        }
        
        // Update totals
        totalUserStaked[msg.sender] -= stake.amount;
        totalStaked -= stake.amount;
        
        // Remove stake from array
        userStakes[msg.sender][stakeIndex] = userStakes[msg.sender][userStakes[msg.sender].length - 1];
        userStakes[msg.sender].pop();
        
        // Return staked tokens
        stakingToken.safeTransfer(msg.sender, stake.amount);
        
        emit Withdrawn(msg.sender, stake.amount, stakeIndex);
    }

    // Get user stakes
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }

    // Update base reward rate
    function setBaseRewardRate(uint256 newRate) external onlyOwner {
        baseRewardRate = newRate;
    }

    // Fund rewards
    function fundRewards(uint256 amount) external onlyOwner {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    // Emergency withdraw without rewards
    function emergencyWithdraw(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake");
        
        uint256 amount = userStakes[msg.sender][stakeIndex].amount;
        
        totalUserStaked[msg.sender] -= amount;
        totalStaked -= amount;
        
        // Remove stake
        userStakes[msg.sender][stakeIndex] = userStakes[msg.sender][userStakes[msg.sender].length - 1];
        userStakes[msg.sender].pop();
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount, stakeIndex);
    }
}
