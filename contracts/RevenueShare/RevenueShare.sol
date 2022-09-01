// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Split, RevenueShareInput} from "../globals.sol";

contract RevenueShare is Initializable {
    Split[] internal splits;
    string public contractName;
    address public owner;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp
    );

    function initialize(RevenueShareInput calldata input, address initOwner)
        external
        initializer
    {
        require(input.splits.length > 0, "No splits configured");
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;

        uint256 sum = 0;
        for (uint256 i = 0; i < input.splits.length; i++) {
            sum += input.splits[i].percentage;
            splits.push(input.splits[i]);
        }
        require(sum == 1e5, "Percentages must equal 1e5");
    }

    function getSplits() external view returns (Split[] memory) {
        return splits;
    }

    receive() external payable {
        Split[] memory memSplits = splits;
        require(memSplits.length > 0, "No splits configured");

        uint256 timestamp = block.timestamp;
        uint256 amount = msg.value;

        for (uint256 i = 0; i < memSplits.length; i++) {
            uint256 withdrawAmount = (amount * memSplits[i].percentage) / 1e5;

            emit Withdrawal(withdrawAmount, memSplits[i].account, timestamp);
            memSplits[i].account.transfer(withdrawAmount);
        }
    }
}
