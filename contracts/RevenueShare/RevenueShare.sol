// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import {Split, RevenueShareInput} from "../globals.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract RevenueShare is Initializable {
    Split[] public splits;
    string public name;

    function initialize(RevenueShareInput calldata input) external initializer {
        require(input.splits.length > 0, "No splits configured");

        name = input.name;

        uint256 sum = 0;
        for (uint256 i = 0; i < input.splits.length; i++) {
            sum += input.splits[i].percentage;
            splits.push(input.splits[i]);
        }
        require(sum == 1e5, "Percentages must equal 1e5");
    }

    receive() external payable {
        Split[] memory memSplits = splits;
        require(memSplits.length > 0, "No splits configured");

        uint256 amount = msg.value;
        for (uint256 i = 0; i < memSplits.length; i++) {
            memSplits[i].account.transfer(
                (amount * memSplits[i].percentage) / 1e5
            );
        }
    }
}
