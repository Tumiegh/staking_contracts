// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract NFTStaking is Ownable, ReentrancyGuard, Pausable, IERC721Receiver {
    using SafeERC20 for IERC20;

    struct StakePosition {
        address owner;
        uint256 stakedAt;
        uint256 lastClaimAt;
    }

    IERC721 public immutable nft;
    IERC20 public immutable rewardToken;

    uint256 public rewardPerSecond;
    uint256 public totalStaked;

    mapping(uint256 => StakePosition) public positionOf;
    mapping(address => uint256) public userStakedCount;

    event Staked(address indexed user, uint256 indexed tokenId);
    event Unstaked(address indexed user, uint256 indexed tokenId);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRewardPerSecond);
    event RewardsFunded(uint256 amount);

    // Set NFT collection address, reward token address, and base reward speed.
    constructor(address nft_, address rewardToken_, uint256 rewardPerSecond_) {
        require(nft_ != address(0), "zero nft");
        require(rewardToken_ != address(0), "zero reward token");

        nft = IERC721(nft_);
        rewardToken = IERC20(rewardToken_);
        rewardPerSecond = rewardPerSecond_;
    }

    // Stake one or many NFTs in a single transaction.
    function stake(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        uint256 length = tokenIds.length;
        require(length > 0, "empty tokenIds");

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            require(positionOf[tokenId].owner == address(0), "already staked");
            require(nft.ownerOf(tokenId) == msg.sender, "not owner");

            // Save position data before transferring NFT into the staking contract.
            positionOf[tokenId] = StakePosition({
                owner: msg.sender,
                stakedAt: block.timestamp,
                lastClaimAt: block.timestamp
            });

            // Track global and per-user totals for fast reads in frontend/tests.
            userStakedCount[msg.sender] += 1;
            totalStaked += 1;

            // Transfer NFT custody to this contract while staked.
            nft.safeTransferFrom(msg.sender, address(this), tokenId);
            emit Staked(msg.sender, tokenId);
        }
    }

    // Claim rewards for a selected list of staked NFTs.
    function claimRewards(uint256[] calldata tokenIds) external nonReentrant {
        uint256 reward = _pending(msg.sender, tokenIds);
        require(reward > 0, "no rewards");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            // After claiming, start a fresh reward timer for each NFT.
            positionOf[tokenIds[i]].lastClaimAt = block.timestamp;
        }

        // Rewards are paid in the ERC20 reward token.
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, reward);
    }

    // Unstake chosen NFTs and pay any pending rewards in the same call.
    function unstake(uint256[] calldata tokenIds) external nonReentrant {
        uint256 length = tokenIds.length;
        require(length > 0, "empty tokenIds");

        // Compute pending rewards first, then return NFTs.
        uint256 reward = _pending(msg.sender, tokenIds);

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            require(positionOf[tokenId].owner == msg.sender, "not staker");

            // Remove stake state first to avoid stale data.
            delete positionOf[tokenId];
            userStakedCount[msg.sender] -= 1;
            totalStaked -= 1;

            // Return NFT back to original staker.
            nft.safeTransferFrom(address(this), msg.sender, tokenId);
            emit Unstaked(msg.sender, tokenId);
        }

        if (reward > 0) {
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardsClaimed(msg.sender, reward);
        }
    }

    // Read helper used by UI/tests to preview rewards before claim/unstake.
    function pendingRewards(address user, uint256[] calldata tokenIds) external view returns (uint256) {
        return _pending(user, tokenIds);
    }

    // Owner can adjust reward speed for future accrual.
    function setRewardRate(uint256 newRewardPerSecond) external onlyOwner {
        rewardPerSecond = newRewardPerSecond;
        emit RewardRateUpdated(newRewardPerSecond);
    }

    // Owner sends reward tokens into this contract so claims can be paid.
    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "amount 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsFunded(amount);
    }

    // Pause only affects new staking; claim/unstake remains available.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // Internal reward calculator shared by claim and unstake.
    function _pending(address user, uint256[] calldata tokenIds) internal view returns (uint256 totalReward) {
        uint256 length = tokenIds.length;
        require(length > 0, "empty tokenIds");

        for (uint256 i = 0; i < length; i++) {
            StakePosition memory position = positionOf[tokenIds[i]];
            require(position.owner == user, "not staker");
            // Linear rewards per NFT: elapsed seconds * rewardPerSecond.
            totalReward += (block.timestamp - position.lastClaimAt) * rewardPerSecond;
        }
    }
}
