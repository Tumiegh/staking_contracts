// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//NFT contract with owner-only minting and configurable base URI.
contract MyNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    string private _baseTokenURI;

    event BaseURIUpdated(string newBaseURI);
    // Emitted after a successful mint.
    event Minted(address indexed to, uint256 indexed tokenId);

    // Initializes the token name/symbol and sets the initial base URI.
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_
    ) ERC721(name_, symbol_) {
        _baseTokenURI = baseTokenURI_;
    }

    // Mints a new NFT. Only the contract owner can call this.
    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");

        // Increment first so token ids start at 1.
        tokenId = ++nextTokenId;
        // Safe mint checks that `to` can receive ERC-721 tokens if it's a contract.
        _safeMint(to, tokenId);

        emit Minted(to, tokenId);
    }

    // Updates the base URI used for all token metadata.
    function setBaseURI(string calldata newBaseTokenURI) external onlyOwner {
        _baseTokenURI = newBaseTokenURI;
        emit BaseURIUpdated(newBaseTokenURI);
    }

    // OpenZeppelin ERC721 uses this to build tokenURI().
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
