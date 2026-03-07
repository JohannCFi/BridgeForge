// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestEURCV
 * @notice Mock ERC-20 token simulating SG Forge's EURCV for the BridgeForge POC.
 *
 * In production, SG Forge controls mint/burn via their CAST Framework.
 * Here, the bridge operator (owner) has mint authority, and any holder can burn.
 *
 * This mirrors the CCTP model:
 * - burn() : called on the source chain to destroy tokens
 * - mint() : called on the destination chain to create tokens
 */
contract TestEURCV is ERC20, Ownable {
    uint8 private constant DECIMALS = 6; // Same as USDC/EURCV

    /// @notice Emitted when tokens are burned for a cross-chain transfer
    event BridgeBurn(address indexed sender, uint256 amount, string destinationChain, string recipientAddress);

    constructor() ERC20("Test EUR CoinVertible", "testEURCV") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to an address. Only the bridge operator can call this.
     * In production, this would be Forge's mint function.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from the caller's balance.
     * Anyone holding testEURCV can burn to initiate a bridge transfer.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn tokens and emit an event with the destination info.
     * This is what the bridge frontend would call to initiate a transfer.
     * The backend listens for BridgeBurn events to trigger the mint on the other chain.
     */
    function bridgeBurn(
        uint256 amount,
        string calldata destinationChain,
        string calldata recipientAddress
    ) external {
        _burn(msg.sender, amount);
        emit BridgeBurn(msg.sender, amount, destinationChain, recipientAddress);
    }
}
