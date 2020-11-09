// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IUserWallet {
    function params(bytes32 _key) external view returns(bytes32);
    function demandETH(address payable _recepient, uint _amount) external;
    function demandERC20(IERC20 _token, address _recepient, uint _amount) external;
    function demand(address payable _target, uint _value, bytes memory _data) 
        external returns(bool, bytes memory);
}
