// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {TokenSwap} from "./TokenSwap.sol";
import {TokenSwapInput} from "../globals.sol";

contract TokenSwapFactory is
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
        implementationAddress = address(new TokenSwap());
        __Ownable_init();
    }

    function updateImplementation() external {
        implementationAddress = address(new TokenSwap());
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function createNewTokenSwap(
        TokenSwapInput calldata input,
        bool isReconfigurable,
        bool isPush,
        uint24 calicaFee
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

        TokenSwap tokenSwap = TokenSwap(cloneAddress);
        tokenSwap.initialize(
            input,
            msg.sender,
            isReconfigurable,
            isPush,
            calicaFee
        );

        return cloneAddress;
    }
}
