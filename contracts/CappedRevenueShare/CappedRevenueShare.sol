// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import {CappedSplit, Split, CappedRevenueShareInput, Payment, MAX_INT} from "../globals.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CappedRevenueShare is Initializable {
    CappedSplit[] internal cappedSplits;
    uint256 public amountTransferred = 0;
    string public name;

    function initialize(CappedRevenueShareInput calldata input)
        external
        initializer
    {
        require(input.cappedSplits.length > 0, "No capped splits given");
        require(input.cappedSplits[0].cap == 0, "First cap must be 0");

        name = input.name;

        int256 lastCap = -1;
        for (uint256 i = 0; i < input.cappedSplits.length; i++) {
            require(
                int256(input.cappedSplits[i].cap) > lastCap,
                "Caps must be sorted and unique"
            );
            validateSplits(input.cappedSplits[i].splits);
            cappedSplits.push(input.cappedSplits[i]);
            lastCap = int256(input.cappedSplits[i].cap);
        }
    }

    function getCappedSplit(uint256 index)
        external
        view
        returns (CappedSplit memory)
    {
        return cappedSplits[index];
    }

    // Creates payment bands for each cap. For example, if caps are [0, 100, 200] then the bands are
    // [0->100], [100->200], [200->MAX_INT]. The amount given is divided among the bands by the given
    // splits and paid out at the end.
    receive() external payable {
        CappedSplit[] memory memCappedSplits = cappedSplits;
        require(memCappedSplits.length > 0, "No splits configured");

        Split[] memory currentSplits = memCappedSplits[0].splits;
        Payment[] memory payments = initializePayments(memCappedSplits);

        uint256 memAmountTransferred = amountTransferred;
        uint256 totalAmount = msg.value + memAmountTransferred;
        uint256 previousCap = 0;

        amountTransferred += msg.value;

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
        for (uint256 i = 0; i < payments.length; i++) {
            if (payments[i].amount != 0) {
                payments[i].account.transfer(payments[i].amount);
            }
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
