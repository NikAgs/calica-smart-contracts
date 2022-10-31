// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import {Expense, ExpenseSubmissionInput} from "../globals.sol";

contract ExpenseSubmission is Initializable {
    Expense[] internal expenses;
    address payable public profitAddress;
    string public contractName;
    address public owner;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp,
        address tokenAddress
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
        require(profitAddress != address(0), "Profit address not set");
        require(msg.sender == owner, "Only owner can reconfigure");

        delete expenses;

        validateAndUpdateExpenses(newExpenses);
    }

    function getExpenses() external view returns (Expense[] memory) {
        return expenses;
    }

    // Reimburses each given expense in order
    function reimburseExpenses(uint256[] calldata expenseIds) external {
        require(profitAddress != address(0), "Profit address not set");
        require(msg.sender == owner, "Only owner can reimburse");

        // solhint-disable-next-line
        uint256 timestamp = block.timestamp;
        Expense[] memory memExpenses = expenses;

        for (uint256 i = 0; i < expenseIds.length; i++) {
            Expense memory expense = memExpenses[expenseIds[i]];

            reimburseExpense(expense, expenseIds[i], timestamp);
        }
    }

    // Reimburses the given expense if the token/ETH balance is sufficient
    function reimburseExpense(
        Expense memory expense,
        uint256 index,
        uint256 timestamp
    ) internal {
        require(expense.amountPaid < expense.cost, "Expense already paid");

        uint256 balance = getTokenBalance(expense.tokenAddress);
        uint256 amountOwed = expense.cost - expense.amountPaid;
        uint256 amountToPay = amountOwed > balance ? balance : amountOwed;

        emit Withdrawal(
            amountToPay,
            expense.account,
            timestamp,
            expense.tokenAddress
        );

        expenses[index].amountPaid += amountToPay;

        transfer(expense.tokenAddress, expense.account, amountToPay);
    }

    // Forwards all specified tokens/ETH to the profit address
    function sendToProfitAddress(address[] calldata tokens) external {
        require(msg.sender == owner, "Only owner can send to profit address");

        // solhint-disable-next-line
        uint256 timestamp = block.timestamp;

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 balance = getTokenBalance(token);

            emit Withdrawal(balance, profitAddress, timestamp, token);

            transfer(token, profitAddress, balance);
        }
    }

    // Returns the balance of the given token address.
    // If the token address is 0, returns the ETH balance.
    function getTokenBalance(address token) internal view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20Upgradeable(token).balanceOf(address(this));
        }
    }

    // Transfers ETH or an ERC20 token to the given address
    function transfer(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (token == address(0)) {
            // solhint-disable-next-line
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "Failed to transfer");
        } else {
            IERC20Upgradeable(token).transfer(to, amount);
        }
    }

    // solhint-disable-next-line
    receive() external payable {}
}
