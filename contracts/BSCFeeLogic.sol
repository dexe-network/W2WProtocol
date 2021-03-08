// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import './SafeERC20.sol';

library BSCFeeLogic {
    using SafeERC20 for IERC20;

    ERC20Burnable constant internal DEXE = ERC20Burnable(0x039cB485212f996A9DBb85A9a75d898F94d38dA6);
    IERC20 constant internal BUSD = IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
    IERC20 constant internal WETH = IERC20(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    IERC20 constant internal USDC = IERC20(0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d);
    IERC20 constant internal USDT = IERC20(0x55d398326f99059fF775485246999027B3197955);
    IERC20 constant ETH = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    IUniswapV2Router02 constant internal ROUTER = IUniswapV2Router02(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    IUniswapV2Factory constant internal FACTORY = IUniswapV2Factory(0xBCfCcbde45cE874adCB698cC183deBcF17952812);

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
        uint _result = _tryDeepSwap(_token, _amountToSwap, BUSD, _forwardContract);
        if (_result > 0) {
            return _result;
        }

        _result = _tryDeepSwap(_token, _amountToSwap, WETH, _forwardContract);
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
