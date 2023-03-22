// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {ExpenseSubmission} from "./ExpenseSubmission.sol";
import {ExpenseSubmissionInput} from "../globals.sol";

contract ExpenseSubmissionFactory is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    address public implementationAddress;

    event ContractDeployed(
        address indexed splitAddress,
        address indexed cloneAddress,
        string contractName
    );

    function initialize() external initializer {
        implementationAddress = address(new ExpenseSubmission());
        __Ownable_init();
    }

    function updateImplementation() external {
        implementationAddress = address(new ExpenseSubmission());
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function createNewExpenseSubmission(ExpenseSubmissionInput calldata input)
        external
        returns (address)
    {
        address memImplementationAddress = implementationAddress;

        require(
            memImplementationAddress != address(0),
            "Must be initialized first"
        );

        address payable cloneAddress = payable(
            ClonesUpgradeable.clone(memImplementationAddress)
        );

        emit ContractDeployed(msg.sender, cloneAddress, input.contractName);
        emit ContractDeployed(
            input.profitAddress,
            cloneAddress,
            input.contractName
        );

        ExpenseSubmission expense = ExpenseSubmission(cloneAddress);
        expense.initialize(input, msg.sender);

        return cloneAddress;
    }
}
