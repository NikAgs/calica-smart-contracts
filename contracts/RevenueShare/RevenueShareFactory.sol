// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {RevenueShare} from "./RevenueShare.sol";
import {RevenueShareInput} from "../globals.sol";

contract RevenueShareFactory is
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
        implementationAddress = address(new RevenueShare());
        __Ownable_init();
    }

    function updateImplementation() external {
        implementationAddress = address(new RevenueShare());
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function createNewRevenueShare(
        RevenueShareInput calldata input,
        bool isReconfigurable
    ) external returns (address) {
        address memImplementationAddress = implementationAddress;

        require(
            memImplementationAddress != address(0),
            "Must be initialized first"
        );

        address payable cloneAddress = payable(
            ClonesUpgradeable.clone(memImplementationAddress)
        );

        emit ContractDeployed(msg.sender, cloneAddress, input.contractName);
        for (uint256 i = 0; i < input.splits.length; i++) {
            if (msg.sender != input.splits[i].account) {
                emit ContractDeployed(
                    input.splits[i].account,
                    cloneAddress,
                    input.contractName
                );
            }
        }

        RevenueShare revenueShare = RevenueShare(cloneAddress);
        revenueShare.initialize(input, msg.sender, isReconfigurable);

        return cloneAddress;
    }
}
