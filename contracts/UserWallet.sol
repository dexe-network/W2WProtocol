// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IUserWallet.sol';
import './ParamsLib.sol';
import './SafeERC20.sol';

contract UserWallet is IUserWallet {
    using SafeERC20 for IERC20;
    using ParamsLib for *;
    bytes32 constant W2W = 'W2W';
    bytes32 constant COPY_TO = 'COPY_TO';
    bytes32 constant OWNER = 'OWNER';

    mapping (bytes32 => bytes32) public override params;

    event ParamUpdated(bytes32 _key, bytes32 _value);

    modifier onlyW2wOrOwner () {
        require(msg.sender == owner() || msg.sender == params[W2W].toAddress());
        _;
    }

    function init(address _w2w, address _owner) external payable {
        require(owner() == address(0), 'Already initialized');
        params[OWNER] = _owner.toBytes32();
        params[W2W] = _w2w.toBytes32();
    }

    function demandETH(address payable _recepient, uint _amount) external override onlyW2wOrOwner() {
        _recepient.transfer(_amount);
    }

    function demandERC20(IERC20 _token, address _recepient, uint _amount) external override onlyW2wOrOwner() {
        uint _thisBalance = _token.balanceOf(address(this));
        if (_thisBalance < _amount) {
            _token.safeTransferFrom(owner(), address(this), (_amount - _thisBalance));
        }
        _token.safeTransfer(_recepient, _amount);
    }

    function demand(address payable _target, uint _value, bytes memory _data) 
    external override onlyW2wOrOwner() returns(bool, bytes memory) {
        return _target.call{value: _value}(_data);
    }

    function owner() public view returns(address) {
        return params[OWNER].toAddress();
    }

    function changeParam(bytes32 _key, bytes32 _value) public {
        require(msg.sender == owner(), 'Not a contract owner');
        params[_key] = _value;
        emit ParamUpdated(_key, _value);
    }
    
    function changeOwner(address _newOwner) public {
        changeParam(OWNER, _newOwner.toBytes32());
    }

    receive() payable external {}
}