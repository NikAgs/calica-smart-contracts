// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../Lib/FullMath.sol";
import "../Lib/TickMath.sol";
import "../interfaces/IWETH9.sol";

import {TokenSwapInput} from "../globals.sol";

contract TokenSwap is Initializable {
    ISwapRouter public constant SWAP_ROUTER =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IUniswapV3Factory public constant UNISWAP_FACTORY =
        IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);

    IWETH9 public weth9;

    string public contractName;

    address public owner;
    address public tokenIn;
    address public tokenOut;
    address public poolAddress;
    address payable public profitAddress;
    address public constant CALICA_FEE_ADDRESS =
        0xAb0279E49891416EADA65e36aE1AEd1A67A15d24;

    uint24 public poolFee;
    uint24 public calicaFee;
    uint24 public slippage;

    bool public isReconfigurable;
    bool public isPush;

    bool internal isSwapping;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp,
        address tokenAddress
    );

    function initialize(
        TokenSwapInput calldata input,
        address initOwner,
        bool initIsReconfigurable,
        bool initIsPush,
        uint24 initCalicaFee
    ) external initializer {
        require(initOwner != address(0), "Owner cant be addr(0)");

        weth9 = IWETH9(input.wethAddress);

        poolAddress = UNISWAP_FACTORY.getPool(
            input.tokenIn == address(0) ? address(weth9) : input.tokenIn,
            input.tokenOut == address(0) ? address(weth9) : input.tokenOut,
            input.poolFee
        );
        require(poolAddress != address(0), "Invalid Uniswap pool");

        contractName = input.contractName;
        owner = initOwner;
        tokenIn = input.tokenIn;
        tokenOut = input.tokenOut;
        profitAddress = input.profitAddress;
        poolFee = input.poolFee;
        calicaFee = initCalicaFee;
        isReconfigurable = initIsReconfigurable;
        isPush = initIsPush;
        slippage = input.slippage;

        isSwapping = false;
    }

    function reconfigure(
        address payable newProfitAddress,
        address newTokenIn,
        address newTokenOut,
        uint24 newFee
    ) external {
        require(isReconfigurable, "Contract isnt reconfigurable");
        require(msg.sender == owner, "Only owner can reconfigure");

        poolAddress = UNISWAP_FACTORY.getPool(
            newTokenIn == address(0) ? address(weth9) : newTokenIn,
            newTokenOut == address(0) ? address(weth9) : newTokenOut,
            newFee
        );
        require(poolAddress != address(0), "Invalid Uniswap pool");

        profitAddress = newProfitAddress;
        tokenIn = newTokenIn;
        tokenOut = newTokenOut;
        poolFee = newFee;
    }

    // Pull function for withdrawing a given list of tokens
    function withdrawTokens(address[] calldata tokens) external {
        require(msg.sender == owner, "Only owner can withdraw");

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = address(this).balance;
            if (tokens[i] != address(0)) {
                balance = IERC20Upgradeable(tokens[i]).balanceOf(address(this));
            }

            if (balance > 0) {
                transfer(tokens[i], owner, balance);
            }
        }
    }

    // Performs a swap to convert tokenIn -> tokenOut and send to the profitAddress
    function swap() public {
        require(poolAddress != address(0), "No pool configured");

        isSwapping = true;

        uint256 balance = address(this).balance;
        if (tokenIn != address(0)) {
            balance = IERC20Upgradeable(tokenIn).balanceOf(address(this));
        }

        require(balance > 0, "No balance to swap");

        // solhint-disable-next-line not-rely-on-time
        uint256 timestamp = block.timestamp;
        uint256 calicaFeeAmount = (balance * calicaFee) / 10000;
        balance -= calicaFeeAmount;

        if (calicaFeeAmount > 0) {
            transfer(tokenIn, CALICA_FEE_ADDRESS, calicaFeeAmount);
            emit Withdrawal(
                calicaFeeAmount,
                CALICA_FEE_ADDRESS,
                timestamp,
                tokenIn
            );
        }

        uint256 amountOutMinimum = calculateAmountOutMinimum(balance);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: profitAddress,
                deadline: timestamp + 60, // TODO: What is a good deadline?
                amountIn: balance,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

        bool unwrapEth = false;
        address unwrapEthRecipient = address(0);

        // Treat address(0) as ETH
        if (tokenIn == address(0)) {
            // Wrap ETH
            params.tokenIn = address(weth9);
            weth9.deposit{value: params.amountIn}();
        }
        if (tokenOut == address(0)) {
            unwrapEth = true;
            unwrapEthRecipient = params.recipient;
            params.tokenOut = address(weth9);
            params.recipient = address(this);
        }

        TransferHelper.safeApprove(
            params.tokenIn,
            address(SWAP_ROUTER),
            params.amountIn
        );

        try SWAP_ROUTER.exactInputSingle(params) returns (uint256 amountOut) {
            // Unwrap WETH9 and transfer to recipient
            if (unwrapEth) {
                weth9.withdraw(amountOut);
                TransferHelper.safeTransferETH(unwrapEthRecipient, amountOut);
            }

            emit Withdrawal(
                amountOut,
                unwrapEthRecipient != address(0)
                    ? unwrapEthRecipient
                    : params.recipient,
                timestamp,
                tokenOut
            );
        } catch {
            if (tokenIn == address(0)) {
                weth9.withdraw(params.amountIn);
            }
        }

        isSwapping = false;
    }

    // Used to calculate the amountOutMinimum for the swap.
    // This is done to prevent frontrunning attacks.
    function calculateAmountOutMinimum(uint256 balance)
        internal
        view
        returns (uint256)
    {
        // Get the TWAP of the last 30 minutes
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = 1800;
        secondsAgos[1] = 0;
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(poolAddress)
            .observe(secondsAgos);
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(
            int24((tickCumulatives[1] - tickCumulatives[0]) / 1800)
        );

        // Calculate the token price ratios.
        // NOTE: One of these values will be 0, depending on the pool's token order.
        uint256 token0Price = FullMath.mulDiv(
            uint256(sqrtPriceX96),
            uint256(sqrtPriceX96),
            2**192
        );
        uint256 token1Price = 2**192 / uint256(sqrtPriceX96);
        token1Price /= uint256(sqrtPriceX96);

        // Use the token price ratios to get the expected amount out for this swap
        address token0 = IUniswapV3Pool(poolAddress).token0();
        uint256 expectedAmountOut;

        address wrappedTokenIn = tokenIn == address(0)
            ? address(weth9)
            : tokenIn;

        if (wrappedTokenIn == token0) {
            expectedAmountOut = token0Price > 0
                ? balance * token0Price
                : balance / token1Price;
        } else {
            expectedAmountOut = token0Price > 0
                ? balance / token0Price
                : balance * token1Price;
        }

        // Allow for slippage
        return FullMath.mulDiv(expectedAmountOut, slippage, 10000);
    }

    // Sends a given amount of a token to a given address.
    // If the tokenAddress is 0, then ETH is sent.
    function transfer(
        address tokenAddress,
        address to,
        uint256 amount
    ) internal {
        if (tokenAddress == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "Failed to transfer");
        } else {
            IERC20Upgradeable(tokenAddress).transfer(to, amount);
        }
    }

    receive() external payable {
        if (isPush && tokenIn == address(0) && !isSwapping) {
            swap();
        }
    }
}
