// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';
import './Constants.sol';
import './IBuyBurner.sol';
import './SafeERC20.sol';

interface IOneSplit {
    function getExpectedReturn(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amount,
        uint256 parts,
        uint256 disableFlags
    )
        external
        view
        returns(
            uint256 returnAmount,
            uint256[] memory distribution
        );

    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory distribution,
        uint256 disableFlags
    ) external payable;
}

contract BuyBurner is IBuyBurner, Constants {
    using SafeERC20 for IERC20;

    IERC20 public constant DEXE = IERC20(0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6);
    IOneSplit public constant ONE_SPLIT = IOneSplit(0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E);

    function approveExchange(IERC20[] calldata _tokens) external override {
        for (uint _i = 0; _i < _tokens.length; _i++) {
            _tokens[_i].safeApprove(address(ONE_SPLIT), type(uint).max);
        }
    }

    receive() payable override external {}

    // Spends the whole balance of a list of _tokens balances in this contract to buyburn Dexe
    // @param _tokens list of ERC20 tokens to spend
    function buyBurn(IERC20[] calldata _tokens) external override {
        for (uint _i = 0; _i < _tokens.length; _i++) {
            IERC20 _token = _tokens[_i];
            uint _amount = 0;
            uint _value = 0;
            if (_token == ETH) {
                _amount = address(this).balance;
                _value = _amount;
            } else {
                _amount = _token.balanceOf(address(this));
            }

            if (_amount == 0) {
                continue;
            }

            if (_token == DEXE) {
                continue;
            }

            (uint _result, uint[] memory _distribution) = ONE_SPLIT.getExpectedReturn(
                _token, DEXE, _amount, 5, 0);

            require(_result > 0, 'Expected return is 0');

            ONE_SPLIT.swap{value: _value}(_token, DEXE, _amount, _result, _distribution, 0);
        }
        ERC20Burnable(address(DEXE)).burn(DEXE.balanceOf(address(this)));
    }
}
