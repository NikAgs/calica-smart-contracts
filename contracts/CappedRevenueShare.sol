// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import {CappedSplit, Split, CappedRevenueShareInput, Payment} from "./globals.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract CappedRevenueShare is Initializable {
    CappedSplit[] public cappedSplits;
    uint256 public amountTransferred = 0;

    function initialize(CappedRevenueShareInput calldata input)
        external
        initializer
    {
        require(input.cappedSplits.length > 0, "No capped splits configured");
        require(input.cappedSplits[0].cap == 0, "First cap must be 0");

        for (uint8 i = 0; i < input.cappedSplits.length; i++) {
            validateSplits(input.cappedSplits[i].splits);
            cappedSplits.push(input.cappedSplits[i]);
        }
    }

    // Creates a payment band for each cap + 1. For example, if caps are [0, 100, 200] then the bands are
    // [0->100], [100->200], [200->MAX_INT]. The amount given is divided among the bands by the given
    // splits and paid out at the end.
    receive() external payable {
        require(cappedSplits.length > 0, "No splits configured");

        uint256 totalAmount = msg.value + amountTransferred;
        Payment[] memory payments;
        Split[] memory currentSplits = cappedSplits[0].splits;
        uint256 previousCap = cappedSplits[0].cap;

        for (uint8 i = 1; i <= cappedSplits.length; i++) {
            uint256 rightBand = i == cappedSplits.length
                ? 2**256 - 1
                : cappedSplits[i].cap;

            uint256 bandOverlap = getAmountOverlap(
                previousCap,
                rightBand,
                totalAmount
            );

            addPayments(payments, currentSplits, bandOverlap);
            currentSplits = cappedSplits[i].splits;
            previousCap = cappedSplits[i].cap;
        }

        payStakeholders(payments);
        amountTransferred += msg.value;
    }

    // Determines how much to add to the payments array for the given split band
    function getAmountOverlap(
        uint256 leftBand,
        uint256 rightBand,
        uint256 totalAmount
    ) internal view returns (uint256) {
        if (amountTransferred >= rightBand || totalAmount <= leftBand) return 0;

        uint256 left = amountTransferred <= leftBand
            ? leftBand
            : amountTransferred;
        uint256 right = totalAmount <= rightBand ? totalAmount : rightBand;

        return right - left;
    }

    // Augments the payments array with the given splits and amount
    function addPayments(
        Payment[] memory payments,
        Split[] memory splits,
        uint256 amount
    ) internal pure {
        if (amount == 0) return;

        for (uint8 i = 0; i < splits.length; i++) {
            Payment memory payment;

            for (uint8 j = 0; j < payments.length; j++) {
                if (payments[j].account == splits[i].account) {
                    payment = payments[j];
                }
            }

            // Didn't find a payment in payments for the account
            if (payment.account == address(0)) {
                payment = Payment(splits[i].account, 0);
            }

            payment.amount += (amount * splits[i].percentage) / 100;
        }
    }

    function payStakeholders(Payment[] memory payments) public payable {
        for (uint8 i = 0; i < payments.length; i++) {
            payments[i].account.transfer(payments[i].amount);
        }
    }

    function validateSplits(Split[] memory splits) private pure {
        uint8 sum = 0;
        for (uint8 i = 0; i < splits.length; i++) {
            sum += splits[i].percentage;
        }
        require(
            sum == 100,
            "The sum of percentages must be 100 for any given split"
        );
    }
}
