// SPDX-License-Identifier: CC-BY-NC-ND

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Split, RevenueShareInput} from "../globals.sol";

contract RevenueShare is Initializable {
    Split[] internal splits;
    bool internal isReconfigurable;

    string public contractName;
    address public owner;

    event Withdrawal(
        uint256 amount,
        address indexed account,
        uint256 timestamp
    );

    function initialize(
        RevenueShareInput calldata input,
        address initOwner,
        bool initIsReconfigurable
    ) external initializer {
        require(input.splits.length > 0, "No splits configured");
        require(initOwner != address(0), "Owner cant be addr(0)");

        contractName = input.contractName;
        owner = initOwner;
        isReconfigurable = initIsReconfigurable;

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

    receive() external payable {
        Split[] memory memSplits = splits;
        require(memSplits.length > 0, "No splits configured");

        // solhint-disable-next-line
        uint256 timestamp = block.timestamp;
        uint256 amount = msg.value;

        for (uint256 i = 0; i < memSplits.length; i++) {
            uint256 withdrawAmount = (amount * memSplits[i].percentage) / 1e5;

            emit Withdrawal(withdrawAmount, memSplits[i].account, timestamp);
            (bool sent, ) = memSplits[i].account.call{value: withdrawAmount}(
                ""
            );
            require(sent, "Failed to transfer");
        }
    }
}
