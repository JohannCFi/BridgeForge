// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./EURCVToken.sol";

contract EURCVBridge is AccessControl, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    EURCVToken public token;
    address public attester;
    uint256 public minAmount;
    uint256 public maxAmount;
    uint32 public immutable localDomain;

    mapping(bytes32 => bool) public usedNonces;
    uint64 public nonce;

    event BurnForBridge(
        bytes32 indexed transferId,
        address indexed sender,
        uint256 amount,
        uint32 destDomain,
        bytes32 recipient,
        uint64 nonce
    );

    event MintFromBridge(
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount,
        uint32 sourceDomain
    );

    struct BridgeMessage {
        uint32 version;
        bytes32 transferId;
        uint32 sourceDomain;
        uint32 destDomain;
        bytes32 sender;
        bytes32 recipient;
        uint256 amount;
        bytes32 burnTxHash;
    }

    constructor(
        address _token,
        address _attester,
        uint32 _localDomain,
        uint256 _minAmount,
        uint256 _maxAmount,
        address admin
    ) {
        token = EURCVToken(_token);
        attester = _attester;
        localDomain = _localDomain;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function depositForBurn(
        uint256 amount,
        uint32 destDomain,
        bytes32 recipient
    ) external whenNotPaused {
        require(amount >= minAmount, "Amount below minimum");
        require(amount <= maxAmount, "Amount above maximum");
        require(destDomain != localDomain, "Cannot bridge to same chain");
        require(recipient != bytes32(0), "Invalid recipient");

        token.burnFrom(msg.sender, amount);

        uint64 currentNonce = nonce++;
        bytes32 transferId = keccak256(
            abi.encodePacked(localDomain, currentNonce)
        );

        emit BurnForBridge(transferId, msg.sender, amount, destDomain, recipient, currentNonce);
    }

    function receiveMessage(
        BridgeMessage calldata message,
        bytes calldata attestation
    ) external whenNotPaused {
        require(message.destDomain == localDomain, "Wrong destination");
        require(!usedNonces[message.transferId], "Already processed");

        bytes32 messageHash = keccak256(abi.encode(
            message.version,
            message.transferId,
            message.sourceDomain,
            message.destDomain,
            message.sender,
            message.recipient,
            message.amount,
            message.burnTxHash
        ));

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(attestation);
        require(signer == attester, "Invalid attestation");

        usedNonces[message.transferId] = true;

        address recipientAddr = address(uint160(uint256(message.recipient)));
        token.mint(recipientAddr, message.amount);

        emit MintFromBridge(
            message.transferId,
            recipientAddr,
            message.amount,
            message.sourceDomain
        );
    }

    function emergencyMint(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        token.mint(to, amount);
    }

    function setAttester(address _attester) external onlyRole(DEFAULT_ADMIN_ROLE) {
        attester = _attester;
    }

    function setMinAmount(uint256 _minAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minAmount = _minAmount;
    }

    function setMaxAmount(uint256 _maxAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxAmount = _maxAmount;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
