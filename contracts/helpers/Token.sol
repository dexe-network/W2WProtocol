// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token is ERC20 {
    constructor(uint _amount) ERC20('Token', 'Token') {
        _mint(msg.sender, _amount);
    }
}
