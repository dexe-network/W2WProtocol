// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';
import './Constants.sol';
import './IBuyBacker.sol';
import './SafeERC20.sol';
import './RevertPropagation.sol';

interface ITradeProvider {
    function trade(IERC20 _tokenFrom, IERC20 _tokenTo, uint _amount, bytes calldata _data) external payable;
}


contract BuyBacker is IBuyBacker, Constants, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public constant DEXE = IERC20(0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6);
    address public trader;
    ITradeProvider public tradeProvider;

    event TraderSet(address newTrader, ITradeProvider newTradeProvider);
    event Execution(address to, uint value, bytes data, bool success, bytes result);
    event BuyBack(IERC20 token, uint amountFrom, uint amountTo);

    modifier onlyBBOwner() {
        require(owner() == _msgSender(), "BB:caller is not the owner");
        _;
    }

    receive() payable override external {}

    function buyBack(IERC20[] calldata _tokens, bytes[] calldata _datas) external override {
        require(msg.sender == trader, 'BB:Only trader is allowed');
        ITradeProvider tradeProv = tradeProvider;
        for (uint i = 0; i < _tokens.length; i++) {
            _buyBack(_tokens[i], tradeProv, _datas[i]);
        }
    }

    function _buyBack(IERC20 _token, ITradeProvider _tradeProvider, bytes memory _data) internal {
        require(_token != DEXE, 'BB:Cannot trade DEXE');
        uint balanceBeforeDEXE = DEXE.balanceOf(address(this));
        uint balanceBeforeToken = _token.balanceOf(address(this));
        uint value = 0;
        if (_token == ETH || address(_token) == address(0)) {
            value = address(this).balance;
        } else {
            _token.safeApprove(address(_tradeProvider), balanceBeforeToken, 'BB:');
        }
        _tradeProvider.trade{value: value}(_token, DEXE, balanceBeforeToken, _data);
        uint balanceAfterDEXE = DEXE.balanceOf(address(this));
        require(balanceAfterDEXE > balanceBeforeDEXE, 'BB:DEXE balance did not increase');
        emit BuyBack(_token, balanceBeforeToken - _token.balanceOf(address(this)),
            balanceBeforeDEXE - balanceAfterDEXE);
    }

    function setTrader(address _trader, ITradeProvider _tradeProvider) external onlyBBOwner() {
        trader = _trader;
        tradeProvider = _tradeProvider;
        emit TraderSet(_trader, _tradeProvider);
    }

    function executeMany(address payable[] calldata _tos, uint[] calldata _values, bytes[] calldata _datas, bool _dontRevert)
    external onlyBBOwner() returns(bool[] memory successes, bytes[] memory results) {
        uint calls = _tos.length;
        successes = new bool[](calls);
        results = new bytes[](calls);
        require(calls == _values.length, 'BB:Invalid values length');
        require(calls == _datas.length, 'BB:Invalid datas length');
        for (uint i = 0; i < calls; i++) {
            (successes[i], results[i]) = _execute(_tos[i], _values[i], _datas[i]);
            RevertPropagation._require(successes[i] || _dontRevert, results[i]);
        }
        return (successes, results);
    }

    function execute(address payable _to, uint _value, bytes calldata _data) external onlyBBOwner() returns(bool, bytes memory) {
        return _execute(_to, _value, _data);
    }

    function _execute(address payable _to, uint _value, bytes memory _data) internal returns(bool success, bytes memory result) {
        (success, result) = _to.call{value: _value}(_data);
        emit Execution(_to, _value, _data, success, result);
        return (success, result);
    }
}
