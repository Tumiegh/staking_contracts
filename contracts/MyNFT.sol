// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    string private _baseTokenURI;

    event BaseURIUpdated(string newBaseURI);
    event Minted(address indexed to, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_
    ) ERC721(name_, symbol_) {
        _baseTokenURI = baseTokenURI_;
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");

        tokenId = ++nextTokenId;
        _safeMint(to, tokenId);

        emit Minted(to, tokenId);
    }

    function setBaseURI(string calldata newBaseTokenURI) external onlyOwner {
        _baseTokenURI = newBaseTokenURI;
        emit BaseURIUpdated(newBaseTokenURI);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
