// SPDX-License-Identifier: CC-BY-NC-ND

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

        emitContractDeployedEvents(cloneAddress, input);

        ExpenseSubmission expense = ExpenseSubmission(cloneAddress);
        expense.initialize(input, msg.sender);

        return cloneAddress;
    }

    // Loops through all the expenses and only emits one ContractDeployed event per unique address encountered.
    // If only solidity had in-memory sets...
    function emitContractDeployedEvents(
        address cloneAddress,
        ExpenseSubmissionInput calldata input
    ) internal {
        emit ContractDeployed(msg.sender, cloneAddress, input.contractName);
        emit ContractDeployed(
            input.profitAddress,
            cloneAddress,
            input.contractName
        );

        uint256 numUniqueAccounts = 0;
        address[] memory uniqueAddresses = new address[](input.expenses.length);

        for (uint256 i = 0; i < input.expenses.length; i++) {
            if (
                msg.sender == input.expenses[i].account ||
                input.profitAddress == input.expenses[i].account
            ) continue;

            for (uint256 k = 0; k < uniqueAddresses.length; k++) {
                if (uniqueAddresses[k] == address(0)) {
                    uniqueAddresses[k] = input.expenses[i].account;
                    numUniqueAccounts++;
                    break;
                } else if (uniqueAddresses[k] == input.expenses[i].account)
                    break;
            }
        }

        for (uint256 i = 0; i < numUniqueAccounts; i++) {
            emit ContractDeployed(
                uniqueAddresses[i],
                cloneAddress,
                input.contractName
            );
        }
    }
}
