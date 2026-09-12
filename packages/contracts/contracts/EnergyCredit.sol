// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title EnergyCredit
/// @notice Deliberately thin on-chain audit trail for wattshare energy credits.
/// Quantities are watt-hours (uint) — no floats. No PII on-chain; users are
/// represented by deterministic pseudo-addresses derived off-chain from userId.
/// Trades complete off-chain first; this contract is the audit trail, not the
/// critical path (IMPLEMENTATION_PLAN.md §8).
contract EnergyCredit is Ownable {
    enum Status {
        Minted,
        Transferred,
        Retired
    }

    struct Credit {
        string creditId;
        uint256 qtyWh;
        address owner;
        Status status;
        uint64 ts;
    }

    address public operator;
    mapping(bytes32 => Credit) public credits;

    event CreditMinted(string creditId, uint256 qtyWh, address owner);
    event CreditTransferred(string creditId, address from, address to, uint256 qtyWh);
    event CreditRetired(string creditId, uint256 qtyWh, string settlementRef);
    event OperatorChanged(address indexed previousOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "EnergyCredit: caller is not the operator");
        _;
    }

    constructor(address initialOperator) Ownable(msg.sender) {
        operator = initialOperator;
    }

    function setOperator(address newOperator) external onlyOwner {
        emit OperatorChanged(operator, newOperator);
        operator = newOperator;
    }

    function _key(string calldata creditId) private pure returns (bytes32) {
        return keccak256(bytes(creditId));
    }

    function mintCredit(string calldata creditId, uint256 qtyWh, address owner_) external onlyOperator {
        bytes32 key = _key(creditId);
        require(credits[key].ts == 0, "EnergyCredit: already minted");
        credits[key] = Credit({ creditId: creditId, qtyWh: qtyWh, owner: owner_, status: Status.Minted, ts: uint64(block.timestamp) });
        emit CreditMinted(creditId, qtyWh, owner_);
    }

    function transferCredit(string calldata creditId, address to, uint256 qtyWh) external onlyOperator {
        bytes32 key = _key(creditId);
        Credit storage c = credits[key];
        require(c.ts != 0, "EnergyCredit: unknown credit");
        address from = c.owner;
        c.owner = to;
        c.status = Status.Transferred;
        emit CreditTransferred(creditId, from, to, qtyWh);
    }

    function retireCredit(string calldata creditId, uint256 qtyWh, string calldata ref) external onlyOperator {
        bytes32 key = _key(creditId);
        Credit storage c = credits[key];
        require(c.ts != 0, "EnergyCredit: unknown credit");
        c.status = Status.Retired;
        emit CreditRetired(creditId, qtyWh, ref);
    }

    function getCredit(string calldata creditId) external view returns (Credit memory) {
        return credits[_key(creditId)];
    }
}
