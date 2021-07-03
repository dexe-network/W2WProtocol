// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import './Wallet2Wallet.sol';
import './BSCFeeLogic.sol';


contract BSCWallet2Wallet is Wallet2Wallet {
    using SafeMath for uint;
    using ExtraMath for uint;
    using ParamsLib for *;

    constructor(address _buyBacker) Wallet2Wallet(_buyBacker) {}

    function _saveFee(IERC20 _token, uint _amount, uint _feePercent, uint _referralFeePercent, IUserWallet _user, address[] memory _feeSwapPath, uint _feeOutMin)
    internal override returns(uint, uint _referralFee, address _referrer) {
        if (_feePercent == 0) {
            return (_amount, 0, address(0));
        }
        uint _fee = _amount.mul(_feePercent).divCeil(HUNDRED_PERCENT);
        if (_referralFeePercent > 0) {
            _referrer = _user.params(REFERRER).toAddress();
            if (_referrer != address(0)) {
                _referralFee = _fee.mul(_referralFeePercent) / HUNDRED_PERCENT;
                _fee = _fee.sub(_referralFee);
            }
        }
        if (_fee > 0 && !BSCFeeLogic.buybackWithUniswap(_token, _fee, _feeSwapPath, _feeOutMin, buyBacker)) {
            fees[_token] = fees[_token].add(_fee);
        }
        return (_amount.sub(_fee).sub(_referralFee), _referralFee, _referrer);
    }
}
