// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import './Wallet2Wallet.sol';
import './BSCFeeLogic.sol';


contract BSCWallet2Wallet is Wallet2Wallet {
    using SafeMath for uint;
    using ExtraMath for uint;

    constructor(address _buyBacker) Wallet2Wallet(_buyBacker) {}

    function _saveFee(IERC20 _token, uint _amount, uint _feePercent) internal override returns(uint) {
        if (_feePercent == 0) {
            return _amount;
        }
        uint _fee = _amount.mul(_feePercent).divCeil(HUNDRED_PERCENT);
        if (!BSCFeeLogic.buybackWithUniswap(_token, _fee, buyBacker)) {
            fees[_token] = fees[_token].add(_fee);
        }
        return _amount.sub(_fee);
    }
}
