// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import {Split, RevenueShareInput} from "../globals.sol";

contract RevenueShare is Initializable {
    Split[] internal splits;

    string public contractName;
    address public owner;
    bool public isReconfigurable;
    bool public isPush;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp,
        address tokenAddress
    );

    function initialize(
        RevenueShareInput calldata input,
        address initOwner,
        bool initIsReconfigurable,
        bool initIsPush
    ) external initializer {
        require(input.splits.length > 0, "No splits configured");
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;
        isReconfigurable = initIsReconfigurable;
        isPush = initIsPush;

        validateAndUpdateSplits(input.splits);
    }

    function validateAndUpdateSplits(Split[] calldata newSplits) internal {
        uint256 sum = 0;
        for (uint256 i = 0; i < newSplits.length; i++) {
            sum += newSplits[i].percentage;
            splits.push(newSplits[i]);
        }
        require(sum == 1e5, "Percentages must equal 1e5");
    }

    function reconfigureSplits(Split[] calldata newSplits) external {
        require(isReconfigurable, "Contract isnt reconfigurable");
        require(msg.sender == owner, "Only owner can reconfigure");

        delete splits;

        validateAndUpdateSplits(newSplits);
    }

    function getSplits() external view returns (Split[] memory) {
        return splits;
    }

    // Pull function for withdrawing a given list of tokens
    function withdrawTokens(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = address(this).balance;
            if (tokens[i] != address(0)) {
                balance = IERC20Upgradeable(tokens[i]).balanceOf(address(this));
            }

            if (balance > 0) {
                distributeSplits(tokens[i], balance);
            }
        }
    }

    // Distributes the splits for a given token.
    // Uses ETH if the token is address(0).
    function distributeSplits(address token, uint256 amount) internal {
        Split[] memory memSplits = splits;
        require(memSplits.length > 0, "No splits configured");

        // solhint-disable-next-line not-rely-on-time
        uint256 timestamp = block.timestamp;

        for (uint256 j = 0; j < memSplits.length; j++) {
            uint256 withdrawAmount = (amount * memSplits[j].percentage) / 1e5;

            emit Withdrawal(
                withdrawAmount,
                memSplits[j].account,
                timestamp,
                token
            );

            transfer(token, memSplits[j].account, withdrawAmount);
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
            distributeSplits(address(0), msg.value);
        }
    }
}
