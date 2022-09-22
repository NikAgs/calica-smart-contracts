// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Expense, ExpenseSubmissionInput} from "../globals.sol";

contract ExpenseSubmission is Initializable {
    Expense[] internal expenses;
    address payable public profitAddress;
    string public contractName;
    address public owner;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp
    );

    function initialize(
        ExpenseSubmissionInput calldata input,
        address initOwner
    ) external initializer {
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;
        profitAddress = input.profitAddress;

        validateAndUpdateExpenses(input.expenses);
    }

    function validateAndUpdateExpenses(Expense[] calldata newExpenses)
        internal
    {
        for (uint256 i = 0; i < newExpenses.length; i++) {
            require(newExpenses[i].amountPaid == 0, "amountPaid must be 0");
            expenses.push(newExpenses[i]);
        }
    }

    function reconfigureExpenses(Expense[] calldata newExpenses) external {
        require(msg.sender == owner, "Only owner can reconfigure");

        delete expenses;

        validateAndUpdateExpenses(newExpenses);
    }

    function getExpenses() external view returns (Expense[] memory) {
        return expenses;
    }

    receive() external payable {
        Expense[] memory memExpenses = expenses;

        // solhint-disable-next-line
        uint256 timestamp = block.timestamp;
        uint256 amount = msg.value;

        for (uint256 i = 0; i < memExpenses.length && amount > 0; i++) {
            uint256 amountOwed = memExpenses[i].amountPaid -
                memExpenses[i].cost;

            if (amountOwed > 0) {
                uint256 amountToPay = amountOwed > amount ? amount : amountOwed;

                emit Withdrawal(amountToPay, memExpenses[i].account, timestamp);
                expenses[i].amountPaid += amountToPay;

                (bool sent, ) = memExpenses[i].account.call{value: amountToPay}(
                    ""
                );
                require(sent, "Failed to transfer");

                amount -= amountToPay;
            }
        }

        if (amount > 0) {
            emit Withdrawal(amount, profitAddress, timestamp);
            (bool sent, ) = profitAddress.call{value: amount}("");
            require(sent, "Failed to transfer");
        }
    }
}
