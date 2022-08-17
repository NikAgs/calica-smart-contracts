// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {CappedRevenueShare} from "./CappedRevenueShare.sol";
import {CappedRevenueShareInput} from "../globals.sol";

contract CappedRevenueShareFactory is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    address public implementationAddress;

    event ContractDeployed(
        address indexed splitAddress,
        address indexed cloneAddress,
        string contractName
    );

    function initialize() external initializer {
        implementationAddress = address(new CappedRevenueShare());
        __Ownable_init();
    }

    function updateImplementation() external {
        implementationAddress = address(new CappedRevenueShare());
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function createNewCappedRevenueShare(CappedRevenueShareInput calldata input)
        external
        returns (address)
    {
        address memImplementationAddress = implementationAddress;

        require(
            memImplementationAddress != address(0),
            "Must be initialized first"
        );

        address payable cloneAddress = payable(
            ClonesUpgradeable.clone(memImplementationAddress)
        );

        emitContractDeployedEvents(cloneAddress, input);

        CappedRevenueShare cappedRevenueShare = CappedRevenueShare(
            cloneAddress
        );
        cappedRevenueShare.initialize(input, msg.sender);

        return cloneAddress;
    }

    // Loops through all the splits and only emits one ContractDeployed event per unique address encountered.
    // If only solidity had in-memory sets...
    function emitContractDeployedEvents(
        address cloneAddress,
        CappedRevenueShareInput calldata input
    ) internal {
        emit ContractDeployed(msg.sender, cloneAddress, input.contractName);

        uint256 maxNumAccounts = 0;
        uint256 numUniqueAccounts = 0;

        for (uint256 i = 0; i < input.cappedSplits.length; i++) {
            maxNumAccounts += input.cappedSplits[i].splits.length;
        }

        address[] memory uniqueAddresses = new address[](maxNumAccounts);

        for (uint256 i = 0; i < input.cappedSplits.length; i++) {
            for (uint256 j = 0; j < input.cappedSplits[i].splits.length; j++) {
                if (msg.sender != input.cappedSplits[i].splits[j].account) {
                    for (uint256 k = 0; k < uniqueAddresses.length; k++) {
                        if (uniqueAddresses[k] == address(0)) {
                            uniqueAddresses[k] = input
                                .cappedSplits[i]
                                .splits[j]
                                .account;
                            numUniqueAccounts++;
                            break;
                        } else if (
                            uniqueAddresses[k] ==
                            input.cappedSplits[i].splits[j].account
                        ) break;
                    }
                }
            }
        }

        for (uint256 i = 0; i < numUniqueAccounts; i++) {
            emit ContractDeployed(
                uniqueAddresses[i],
                cloneAddress,
                input.contractName
            );
        }
    }
}
