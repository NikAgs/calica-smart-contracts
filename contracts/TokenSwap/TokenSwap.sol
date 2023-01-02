// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import {TokenSwapInput} from "../globals.sol";

// import "../CalicaUniswapLibrary/CalicaUniswapLibrary.sol" as CalicaUniswapLibrary;

contract TokenSwap is Initializable {
    string public contractName;

    address public owner;
    address public tokenIn;
    address public tokenOut;
    address public poolAddress;
    address payable public profitAddress;

    uint256 public poolFee;
    uint256 public calicaFee;

    bool public isReconfigurable;
    bool public isPush;

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
        uint256 initCalicaFee
    ) external initializer {
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;
        tokenIn = input.tokenIn;
        tokenOut = input.tokenOut;
        poolAddress = input.poolAddress;
        profitAddress = input.profitAddress;
        poolFee = input.poolFee;
        calicaFee = initCalicaFee;
        isReconfigurable = initIsReconfigurable;
        isPush = initIsPush;
    }

    function reconfigureProfitAddress(address payable newProfitAddress)
        external
    {
        require(isReconfigurable, "Contract isnt reconfigurable");
        require(msg.sender == owner, "Only owner can reconfigure");

        profitAddress = newProfitAddress;
    }

    // Pull function for withdrawing a given list of tokens
    function withdrawTokens(address[] calldata tokens) external {
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

    function swapAndDistributeTokens(address[] memory tokens) public {
        // CalicaUniswapLibrary.ISwapRouter.ExactInputSingleParams[]
        //     memory swaps = new CalicaUniswapLibrary.ISwapRouter.ExactInputSingleParams[](
        //         tokens.length
        //     );

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = address(this).balance;
            if (tokens[i] != address(0)) {
                balance = IERC20Upgradeable(tokens[i]).balanceOf(address(this));
            }

            if (balance > 0) {
                if (tokens[i] == tokenOut) {
                    transfer(tokens[i], profitAddress, balance);
                } else {
                    // swaps[i] = CalicaUniswapLibrary.ISwapRouter
                    //     .ExactInputSingleParams({
                    //     tokenIn: tokens[i],
                    //     tokenOut: payoutToken,
                    //     fee: 3000,
                    //     recipient: address(this),
                    //     deadline: block.timestamp + 60,
                    //     amountIn: balance,
                    //     amountOutMinimum: 0,
                    //     sqrtPriceLimitX96: 0
                    // });
                }
            }
        }
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
        if (isPush) {
            swapAndDistributeTokens(new address[](0));
        }
    }
}
