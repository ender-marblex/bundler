//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

/**
 * Simple test paymaster that accepts all UserOps without validation.
 * Does NOT validate EntryPoint interface - works with any EntryPoint version.
 */
contract SimplePaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "only entryPoint");
        _;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata,
        bytes32,
        uint256
    ) external view override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        return ("", 0); // Accept all
    }

    function postOp(
        PostOpMode,
        bytes calldata,
        uint256,
        uint256
    ) external override onlyEntryPoint {
        // Do nothing
    }

    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }
}
