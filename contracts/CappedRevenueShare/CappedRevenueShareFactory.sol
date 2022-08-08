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
    event ContractDeployed(address indexed owner, address indexed cloneAddress);

    function initialize() external initializer {
        implementationAddress = address(new CappedRevenueShare());
        __Ownable_init();
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

        emit ContractDeployed(msg.sender, cloneAddress);

        CappedRevenueShare cappedRevenueShare = CappedRevenueShare(
            cloneAddress
        );
        cappedRevenueShare.initialize(input);

        return cloneAddress;
    }
}
