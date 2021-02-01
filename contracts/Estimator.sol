// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import './Wallet2Wallet.sol';

contract Estimator {
    bytes32 constant public EXECUTOR_ROLE = bytes32('Executor');
    function estimate(Wallet2Wallet _w2w, bytes calldata _data) external returns(uint) {
        require(_w2w.hasRole(EXECUTOR_ROLE, msg.sender), 'EST:Only Executor');
        uint gasUsed = gasleft();
        (bool success, bytes memory result) = address(_w2w).call(_data);
        gasUsed = gasUsed - gasleft();
        RevertPropagation._require(success, result);
        (success, result) = abi.decode(result, (bool, bytes));
        RevertPropagation._require(success, result);
        return gasUsed;
    }
}
