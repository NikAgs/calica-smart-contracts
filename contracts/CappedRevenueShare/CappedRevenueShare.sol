// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import {CappedSplit, Split, CappedRevenueShareInput, Payment, MAX_INT} from "../globals.sol";

contract CappedRevenueShare is Initializable {
    CappedSplit[] internal cappedSplits;

    bool public isReconfigurable;
    bool public isPush;
    uint256 public amountTransferred = 0;
    string public contractName;
    address public owner;
    address public tokenAddress;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp
    );

    function initialize(
        CappedRevenueShareInput calldata input,
        address initOwner,
        address initTokenAddress,
        bool initIsReconfigurable,
        bool initIsPush
    ) external initializer {
        require(input.cappedSplits.length > 0, "No capped splits given");
        require(input.cappedSplits[0].cap == 0, "First cap must be 0");
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;
        tokenAddress = initTokenAddress;
        isReconfigurable = initIsReconfigurable;
        isPush = initIsPush;

        validateAndUpdateCappedSplits(input.cappedSplits);
    }

    function validateAndUpdateCappedSplits(
        CappedSplit[] calldata newCappedSplits
    ) internal {
        int256 lastCap = -1;
        for (uint256 i = 0; i < newCappedSplits.length; i++) {
            require(
                int256(newCappedSplits[i].cap) > lastCap,
                "Caps must be sorted and unique"
            );
            validateSplits(newCappedSplits[i].splits);
            cappedSplits.push(newCappedSplits[i]);
            lastCap = int256(newCappedSplits[i].cap);
        }
    }

    function getCappedSplits() external view returns (CappedSplit[] memory) {
        return cappedSplits;
    }

    function reconfigureCappedSplits(CappedSplit[] calldata newCappedSplits)
        external
    {
        require(isReconfigurable, "Contract isnt reconfigurable");
        require(msg.sender == owner, "Only owner can reconfigure");

        delete cappedSplits;

        validateAndUpdateCappedSplits(newCappedSplits);
    }

    // Pull function for withdrawing a given list of tokens. Only distribute splits for the tokenAddress of this contract.
    // Otherwise, send the token balance to the owner.
    function withdrawTokens(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = address(this).balance;
            if (tokens[i] != address(0)) {
                balance = IERC20Upgradeable(tokens[i]).balanceOf(address(this));
            }

            if (tokenAddress == tokens[i]) {
                distributeCappedSplits(balance);
            } else if (balance > 0) {
                transfer(tokens[i], owner, balance);
            }
        }
    }

    // Creates payment bands for each cap. For example, if caps are [0, 100, 200] then the bands are
    // [0->100], [100->200], [200->MAX_INT]. The amount given is divided among the bands by the given
    // splits and paid out at the end.
    function distributeCappedSplits(uint256 balance) internal {
        CappedSplit[] memory memCappedSplits = cappedSplits;
        require(memCappedSplits.length > 0, "No splits configured");

        Split[] memory currentSplits = memCappedSplits[0].splits;
        Payment[] memory payments = initializePayments(memCappedSplits);

        uint256 memAmountTransferred = amountTransferred;
        uint256 totalAmount = balance + memAmountTransferred;
        uint256 previousCap = 0;

        amountTransferred += balance;

        for (uint8 i = 1; i <= memCappedSplits.length; i++) {
            uint256 rightBand = i == memCappedSplits.length
                ? MAX_INT
                : memCappedSplits[i].cap;

            uint256 bandOverlap = getAmountOverlap(
                previousCap,
                rightBand,
                memAmountTransferred,
                totalAmount
            );

            addPayments(payments, currentSplits, bandOverlap);

            if (i < memCappedSplits.length) {
                currentSplits = memCappedSplits[i].splits;
                previousCap = memCappedSplits[i].cap;
            }
        }

        payStakeholders(payments);
    }

    receive() external payable {
        if (isPush && tokenAddress == address(0)) {
            distributeCappedSplits(msg.value);
        }
    }

    // Determines how much to add to the payments array for the given split band
    function getAmountOverlap(
        uint256 leftBand,
        uint256 rightBand,
        uint256 memAmountTransferred,
        uint256 totalAmount
    ) private pure returns (uint256) {
        if (memAmountTransferred >= rightBand || totalAmount <= leftBand)
            return 0;

        uint256 left = memAmountTransferred <= leftBand
            ? leftBand
            : memAmountTransferred;
        uint256 right = totalAmount <= rightBand ? totalAmount : rightBand;

        return right - left;
    }

    // Creates an array of payments with 0 amounts for each unique split address
    function initializePayments(CappedSplit[] memory memCappedSplits)
        private
        pure
        returns (Payment[] memory)
    {
        uint256 maxNumAccounts = 0;
        uint256 uniqueAccounts = 0;

        for (uint256 i = 0; i < memCappedSplits.length; i++) {
            maxNumAccounts += memCappedSplits[i].splits.length;
        }

        // Arrays in memory must be fixed length
        Payment[] memory payments = new Payment[](maxNumAccounts);

        for (uint256 i = 0; i < memCappedSplits.length; i++) {
            for (uint256 j = 0; j < memCappedSplits[i].splits.length; j++) {
                for (uint256 k = 0; k < payments.length; k++) {
                    if (payments[k].account == address(0)) {
                        payments[k] = Payment(
                            memCappedSplits[i].splits[j].account,
                            0
                        );
                        uniqueAccounts++;
                        break;
                    } else if (
                        payments[k].account ==
                        memCappedSplits[i].splits[j].account
                    ) break;
                }
            }
        }

        Payment[] memory trimmedPayments = new Payment[](uniqueAccounts);
        for (uint256 i = 0; i < uniqueAccounts; i++) {
            trimmedPayments[i] = payments[i];
        }

        return trimmedPayments;
    }

    // Augments the payments array with the given splits and amount
    function addPayments(
        Payment[] memory payments,
        Split[] memory splits,
        uint256 amount
    ) private pure {
        if (amount == 0) return;

        for (uint256 i = 0; i < splits.length; i++) {
            for (uint256 j = 0; j < payments.length; j++) {
                if (payments[j].account == splits[i].account) {
                    Payment memory payment = payments[j];
                    payment.amount += (amount * splits[i].percentage) / 1e5;
                    break;
                }
            }
        }
    }

    // Iterates the payments array and transfers the amount to each account
    function payStakeholders(Payment[] memory payments) private {
        // solhint-disable-next-line
        uint256 timestamp = block.timestamp;

        for (uint256 i = 0; i < payments.length; i++) {
            if (payments[i].amount != 0) {
                emit Withdrawal(
                    payments[i].amount,
                    payments[i].account,
                    timestamp
                );
                transfer(tokenAddress, payments[i].account, payments[i].amount);
            }
        }
    }

    // Sends a given amount of a token to a given address.
    // If the transferTokenAddress is 0, then ETH is sent.
    function transfer(
        address transferTokenAddress,
        address to,
        uint256 amount
    ) internal {
        if (transferTokenAddress == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "Failed to transfer");
        } else {
            IERC20Upgradeable(transferTokenAddress).transfer(to, amount);
        }
    }

    function validateSplits(Split[] memory splits) private pure {
        uint256 sum = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            sum += splits[i].percentage;
        }
        require(sum == 1e5, "Percentages must equal 1e5");
    }
}
