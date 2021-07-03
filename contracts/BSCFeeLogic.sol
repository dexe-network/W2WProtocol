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
    IERC20 constant internal WETH = IERC20(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    IERC20 constant ETH = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    IUniswapV2Router02 constant internal ROUTER = IUniswapV2Router02(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    IUniswapV2Factory constant internal FACTORY = IUniswapV2Factory(0xBCfCcbde45cE874adCB698cC183deBcF17952812);

    function buybackWithUniswap(
        IERC20 _token,
        uint _amountToSwap,
        address[] memory _feeSwapPath,
        uint _feeOutMin,
        address _forwardContract
    ) internal returns(bool) {
        if (DEXE == _token) {
            _token.safeTransfer(_forwardContract, _amountToSwap, 'W2W:FL:');
            return true;
        }

        if (_feeSwapPath.length < 2) {
            return false;
        }

        uint feeOut = ROUTER.getAmountsOut(_amountToSwap, _feeSwapPath)[_feeSwapPath.length - 1];

        if (feeOut < _feeOutMin) {
            return false;
        }

        if (_token == ETH) {
            (bool result, ) = payable(address(WETH)).call{value: _amountToSwap}('');
            if (!result) {
                return false;
            }
            _token = WETH;
        }

        _token.safeApprove(address(ROUTER), _amountToSwap, 'W2W:FL:');
        ROUTER.swapExactTokensForTokens(_amountToSwap, feeOut, _feeSwapPath, _forwardContract, block.timestamp);
        return true;
    }
}
