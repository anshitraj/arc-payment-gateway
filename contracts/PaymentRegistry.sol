// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PaymentRegistry
 * @notice Minimal payment registry for ARC Testnet
 * @dev NON-CUSTODIAL: Contract never holds funds, only emits events
 */
contract PaymentRegistry {
    // Events
    event PaymentCreated(
        string indexed paymentId,
        address indexed merchant,
        uint256 amount,
        string currency
    );

    event PaymentConfirmed(
        string indexed paymentId,
        address indexed payer,
        bytes32 indexed txHash
    );

    // Mapping: paymentId -> txHash
    mapping(string => bytes32) public paymentTxHashes;

    /**
     * @notice Emit payment creation event
     * @param paymentId Unique payment identifier
     * @param merchant Merchant wallet address
     * @param amount Payment amount (in token's smallest unit)
     * @param currency Currency symbol (e.g., "USDC")
     */
    function createPayment(
        string memory paymentId,
        address merchant,
        uint256 amount,
        string memory currency
    ) external {
        emit PaymentCreated(paymentId, merchant, amount, currency);
    }

    /**
     * @notice Record payment confirmation with transaction hash
     * @param paymentId Unique payment identifier
     * @param payer Payer wallet address
     * @param txHash Transaction hash of the payment
     */
    function confirmPayment(
        string memory paymentId,
        address payer,
        bytes32 txHash
    ) external {
        paymentTxHashes[paymentId] = txHash;
        emit PaymentConfirmed(paymentId, payer, txHash);
    }

    /**
     * @notice Get transaction hash for a payment
     * @param paymentId Unique payment identifier
     * @return txHash Transaction hash (0x0 if not found)
     */
    function getPaymentTxHash(string memory paymentId) external view returns (bytes32) {
        return paymentTxHashes[paymentId];
    }
}
