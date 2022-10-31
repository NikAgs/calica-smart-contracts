// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

uint256 constant MAX_INT = 2**256 - 1;

struct Split {
    string name;
    address payable account;
    uint256 percentage;
}

struct CappedSplit {
    uint256 cap;
    Split[] splits;
}

struct Payment {
    address payable account;
    uint256 amount;
}

struct RevenueShareInput {
    string contractName;
    Split[] splits;
}

struct CappedRevenueShareInput {
    string contractName;
    CappedSplit[] cappedSplits;
}

struct Expense {
    string name;
    address payable account;
    uint256 cost;
    uint256 amountPaid;
    address tokenAddress;
    string description;
}

struct ExpenseSubmissionInput {
    string contractName;
    Expense[] expenses;
    address payable profitAddress;
}
