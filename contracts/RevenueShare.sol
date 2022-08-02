// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import {Split, RevenueShareInput} from "./globals.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract RevenueShare is Initializable {
    Split[] public splits;

    function initialize(RevenueShareInput calldata input) external initializer {
        require(input.splits.length > 0, "No splits configured");

        uint8 sum = 0;
        for (uint8 i = 0; i < input.splits.length; i++) {
            sum += input.splits[i].percentage;
            splits.push(input.splits[i]);
        }
        require(sum == 100, "The sum of percentages must be 100");
    }

    receive() external payable {
        require(splits.length > 0, "No splits configured");
        uint256 amount = msg.value;
        for (uint8 i = 0; i < splits.length; i++) {
            splits[i].account.transfer((amount * splits[i].percentage) / 100);
        }
    }
}
