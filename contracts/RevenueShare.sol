// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
// import "hardhat/console.sol";

struct Split {
    address payable account;
    uint8 percentage;
}

contract RevenueShare is Initializable {
    Split[] public splits;

    function initialize(Split[] calldata _splits) public initializer {
        uint8 sum = 0;
        for (uint8 i = 0; i < _splits.length; i++) {
            sum += _splits[i].percentage;
            splits.push(_splits[i]);
        }
        require(sum == 100, "The sum of percentages must be 100");
    }

    receive() external payable {
        require(splits.length > 0, "No splits configured");
        for (uint8 i = 0; i < splits.length; i++) {
            splits[i].account.transfer(
                (msg.value * splits[i].percentage) / 100
            );
        }
    }
}
