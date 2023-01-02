// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../interfaces/IWETH9.sol";

library CalicaUniswapLibrary {
    ISwapRouter public constant SWAP_ROUTER =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    IWETH9 public constant WETH9 =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    // Executes batch swaps using Uniswap V3
    function performSwaps(ISwapRouter.ExactInputSingleParams[] calldata params)
        public
        returns (uint256[] memory)
    {
        // TODO: Combine duplicate swaps
        // TODO: Reduce swaps from x->y and y->x

        uint256[] memory amountOuts = new uint256[](params.length);

        for (uint256 i = 0; i < params.length; i++) {
            ISwapRouter.ExactInputSingleParams memory param = params[i];
            bool unwrapEth = false;
            address unwrapEthRecipient = address(0);

            // Treat address(0) as ETH
            if (param.tokenIn == address(0)) {
                // Wrap ETH
                param.tokenIn = address(WETH9);
                WETH9.deposit{value: param.amountIn}();
            }
            if (param.tokenOut == address(0)) {
                unwrapEth = true;
                unwrapEthRecipient = param.recipient;
                param.tokenOut = address(WETH9);
                param.recipient = address(this);
            }

            TransferHelper.safeApprove(
                param.tokenIn,
                address(SWAP_ROUTER),
                param.amountIn
            );

            amountOuts[i] = SWAP_ROUTER.exactInputSingle(param);

            // Unwrap WETH9 and transfer to recipient
            if (unwrapEth) {
                WETH9.withdraw(amountOuts[i]);
                TransferHelper.safeTransferETH(
                    unwrapEthRecipient,
                    amountOuts[i]
                );
            }
        }

        return amountOuts;
    }
}
