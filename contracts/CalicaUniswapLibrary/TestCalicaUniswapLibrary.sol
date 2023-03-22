// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.7;

import "./CalicaUniswapLibrary.sol";

// Dummy contract to test CalicaUniswapLibrary
contract TestCalicaUniswapLibrary {
    function testPerformSwaps(
        ISwapRouter.ExactInputSingleParams[] calldata input
    ) external returns (uint256[] memory) {
        uint256[] memory res = CalicaUniswapLibrary.performSwaps(input);
        return res;
    }

    // solhint-disable-next-line
    receive() external payable {}
}
