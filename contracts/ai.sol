// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StakingContract is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_WEEKLY_RATE_BPS = 50; // 0.5% per week
    uint256 public constant MAX_WEEKLY_RATE_BPS = 200; // 2% per week safety cap

    // Tokens
    IERC20 public stakingToken;
    IERC20 public rewardToken;

    // Staking variables
    uint256 public weeklyRateBps; // weekly reward rate in basis points (100 = 1% per week)
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;
    uint256 public rewardsPool; // unallocated reward tokens available for distribution
    
    // Staking duration
    uint256 public stakingDuration = 30 days;
    
    // Maps
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public stakingTimestamp;

    // Events
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event WeeklyRateUpdated(uint256 newWeeklyRateBps);
    event StakingDurationUpdated(uint256 newDuration);
    event RewardsFunded(uint256 amount);

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _weeklyRateBps
    ) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        weeklyRateBps = _weeklyRateBps == 0 ? DEFAULT_WEEKLY_RATE_BPS : _weeklyRateBps;
        require(weeklyRateBps <= MAX_WEEKLY_RATE_BPS, "Weekly rate too high");
        lastUpdateTime = block.timestamp;
    }

    // Modifier to update rewards
    modifier updateReward(address account) {
        _updateRewardState();
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // Internal: update global reward state and allocate from rewardsPool.
    function _updateRewardState() internal {
        if (totalStaked == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }

        uint256 dt = block.timestamp - lastUpdateTime;
        if (dt == 0 || rewardsPool == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }

        uint256 potentialReward = (totalStaked * weeklyRateBps * dt) / (7 days * 10000);
        uint256 actualReward = potentialReward;
        if (actualReward > rewardsPool) {
            actualReward = rewardsPool;
        }

        if (actualReward > 0) {
            rewardPerTokenStored += (actualReward * 1e18) / totalStaked;
            rewardsPool -= actualReward;
        }

        lastUpdateTime = block.timestamp;
    }

    // Calculate reward per token
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }

        uint256 dt = block.timestamp - lastUpdateTime;
        if (dt == 0 || rewardsPool == 0) {
            return rewardPerTokenStored;
        }

        uint256 potentialReward = (totalStaked * weeklyRateBps * dt) / (7 days * 10000);
        uint256 actualReward = potentialReward;
        if (actualReward > rewardsPool) {
            actualReward = rewardsPool;
        }

        return rewardPerTokenStored + ((actualReward * 1e18) / totalStaked);
    }

    // Calculate earned rewards for an account
    function earned(address account) public view returns (uint256) {
        return (stakedBalance[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) + rewards[account];
    }

    // Stake tokens
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        
        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        stakingTimestamp[msg.sender] = block.timestamp;
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Staked(msg.sender, amount);
    }

    // Withdraw staked tokens
    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient balance");
        require(block.timestamp >= stakingTimestamp[msg.sender] + stakingDuration, "Still locked");
        
        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    // Get reward
    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // Withdraw and get reward in one transaction
    function withdrawAndGetReward() external {
        withdraw(stakedBalance[msg.sender]);
        getReward();
    }

    // Admin functions
    function setWeeklyRateBps(uint256 _weeklyRateBps) external onlyOwner updateReward(address(0)) {
        require(_weeklyRateBps <= MAX_WEEKLY_RATE_BPS, "Weekly rate too high");
        weeklyRateBps = _weeklyRateBps;
        emit WeeklyRateUpdated(_weeklyRateBps);
    }

    // Reset to a realistic default weekly rate.
    function resetWeeklyRate() external onlyOwner updateReward(address(0)) {
        weeklyRateBps = DEFAULT_WEEKLY_RATE_BPS;
        emit WeeklyRateUpdated(DEFAULT_WEEKLY_RATE_BPS);
    }

    function setStakingDuration(uint256 _duration) external onlyOwner {
        stakingDuration = _duration;
        emit StakingDurationUpdated(_duration);
    }

    // Emergency withdraw (no rewards)
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakedBalance[msg.sender];
        require(amount > 0, "No tokens staked");
        
        stakedBalance[msg.sender] = 0;
        totalStaked -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    // Fund contract with rewards
    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsFunded(amount);
    }

    // Pause/Unpause staking
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
