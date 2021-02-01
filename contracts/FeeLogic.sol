// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import './SafeERC20.sol';

library FeeLogic {
    using SafeERC20 for IERC20;

    ERC20Burnable constant internal DEXE = ERC20Burnable(0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6);
    IERC20 constant internal WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 constant internal USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 constant internal USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 constant ETH = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    IUniswapV2Router02 constant internal ROUTER = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IUniswapV2Factory constant internal FACTORY = IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    function buybackWithUniswap(
        IERC20 _token,
        uint _amountToSwap,
        address _forwardContract
    ) internal returns(bool) {
        if (DEXE == _token) {
            _token.safeTransfer(_forwardContract, _amountToSwap, 'W2W:FL:');
            return true;
        }

        uint _result = _swapDirect(_token, _amountToSwap, _forwardContract);
        if (_result > 0) {
            return true;
        }

        _result = _deepSwap(_token, _amountToSwap, _forwardContract);
        if (_result > 0) {
            return true;
        }

        return false;
    }

    function _swapDirect(IERC20 _token, uint _amountToSwap, address _forwardContract) private returns(uint) {
        if (_token == ETH) {
            (bool result, ) = payable(address(WETH)).call{value: _amountToSwap}('');
            require(result, 'WETH deposit failed');
            _token = WETH;
        }
        if (_token != WETH && FACTORY.getPair(address(_token), address(DEXE)) == address(0)) {
            return 0;
        }
        _token.safeApprove(address(ROUTER), _amountToSwap, 'W2W:FL:');
        address[] memory path =  new address[](2);
        path[0] = address(_token);
        path[1] = address(DEXE);

        return ROUTER.swapExactTokensForTokens(_amountToSwap, 1, path, _forwardContract, block.timestamp)[1];
    }

    function _deepSwap(IERC20 _token, uint _amountToSwap, address _forwardContract) private returns(uint) {
        uint _result = _tryDeepSwap(_token, _amountToSwap, WETH, _forwardContract);
        if (_result > 0) {
            return _result;
        }

        _result = _tryDeepSwap(_token, _amountToSwap, USDC, _forwardContract);
        if (_result > 0) {
            return _result;
        }

        _result = _tryDeepSwap(_token, _amountToSwap, USDT, _forwardContract);
        if (_result > 0) {
            return _result;
        }

        return 0;
    }

    function _tryDeepSwap(IERC20 _token, uint _amountToSwap, IERC20 _middleToken, address _forwardContract) private returns(uint) {
        if (FACTORY.getPair(address(_token), address(_middleToken)) != address(0)) {
            _token.safeApprove(address(ROUTER), _amountToSwap, 'W2W:FL:');

            address[] memory path =  new address[](3);
            path[0] = address(_token);
            path[1] = address(_middleToken);
            path[2] = address(DEXE);

            return ROUTER.swapExactTokensForTokens(_amountToSwap, 1, path, _forwardContract, block.timestamp)[2];
        }

        return 0;
    }
}
