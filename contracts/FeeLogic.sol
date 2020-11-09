// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import './SafeERC20.sol';

library FeeLogic {
    using SafeERC20 for IERC20;

    ERC20Burnable constant internal DEXE = ERC20Burnable(0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6);
    IERC20 constant internal WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IUniswapV2Router02 constant internal ROUTER = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IUniswapV2Factory constant internal FACTORY = IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    function _burnWithUniswap(
        IERC20 _token,
        uint _amountToBurn,
        address _forwardContractToBurn
    ) internal {
        if (DEXE == _token) {
            _burn(_amountToBurn);
            return;
        }

        uint _result = _swapDirect(_token, _amountToBurn);
        if (_result > 0) {
            _burn(_result);
            return;
        }

        _result = _deepSwap(_token, _amountToBurn);
        if (_result > 0) {
            _burn(_result);
            return;
        }

        _token.safeTransfer(_forwardContractToBurn, _amountToBurn);
    }

    function _burn(uint _amount) private {
        DEXE.burn(_amount);
    }

    function _swapDirect(IERC20 _token, uint _amountToBurn) private returns(uint) {
        if (_token == WETH) {
            _token.safeApprove(address(ROUTER), _amountToBurn);
            address[] memory path =  new address[](2);
            path[0] = address(_token);
            path[1] = address(DEXE);

            return ROUTER.swapExactTokensForTokens(_amountToBurn, 0, path, address(this), block.timestamp)[1];
        }

        return 0;
    }

    function _deepSwap(IERC20 _token, uint _amountToBurn) private returns(uint) {
        uint _result = _tryDeepSwap(_token, _amountToBurn, WETH);
        if (_result > 0) {
            return _result;
        }

        return 0;
    }

    function _tryDeepSwap(IERC20 _token, uint _amountToBurn, IERC20 _middleToken) private returns(uint) {
        if (FACTORY.getPair(address(_token), address(_middleToken)) != address(0)) {
            _token.safeApprove(address(ROUTER), _amountToBurn);

            address[] memory path =  new address[](3);
            path[0] = address(_token);
            path[1] = address(_middleToken);
            path[2] = address(DEXE);

            return ROUTER.swapExactTokensForTokens(_amountToBurn, 0, path, address(this), block.timestamp)[2];
        }

        return 0;
    }
}
