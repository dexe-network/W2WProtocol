# Wallet2Wallet

## Installation

**NodeJS 12.x+ must be installed as a prerequisite.**

```
$ npm install
```

## Deploy to mainnet

 1. Install dependencies
 2. Add .env file
 3. Set GAS_PRICE_GWEI in .env file (optional)
 4. Set PRIVATE_KEY in .env file
 5. Set RPC_URL in .env file
 6. If updating from v2 to v3 set MODE='2to3' in .env file
 7. run: npm run mainnet-deploy or npm run bsc-deploy

## Running tests

Tests are run on Ethereum mainnet fork, you need node url to run the fork.

```
$ npm run ganache-mainnet -- mainnet-node-url
$ npm run test
```

## UserWalletFactory

User needs to deploy a wallet for himself sending along ETH that will be used to cover copy fees.

    getUserWallet(address _user) view returns(address); // Get address of the user wallet, or 0x0 if not deployed.
    deployUserWallet(address _w2w, address _referrer) payable; // Deploy user wallet for transaction sender.
    deployUserWalletFor(address _w2w, address _user, address _referrer) payable; // Deploy user wallet for specific user.

## UserWallet

    changeParam(bytes32 _key, bytes32 _value); // Set value of an arbitrary key.
        changeParam(
            '0x5732570000000000000000000000000000000000000000000000000000000000', // W2W key is used to indicate current Wallet2Wallet contract address. Only the one specified here has access to user's funds.
            '0x000000000000000000000000cafecafecafecafecafecafecafecafecafecafe'  // 0xcafecafecafecafecafecafecafecafecafecafe contract address.
        );
    changeOwner(address _owner); // Set new owner.
    owner() view returns(address); // Get current wallet owner.
    params(bytes32 _key) view returns(bytes32); // Get value by an arbitrary key.

## BuyBacker

    buyBack(IERC20[] _tokens, bytes[] _datas); // Buy DEXE with TradeProvider using all the specified tokens, then keep them store them.

## Contributing ![JS Code Style](https://img.shields.io/badge/js--style-extends--google-green.svg 'JS Code Style') ![Solidity Code Style](https://img.shields.io/badge/sol--style-ambisafe-red.svg 'Solidity Code Style')

In order to validate consistency of your changes run:

```
$ npm run validate
```

## Code Style

JS: based on Google, though with only single indentations even for arguments.

Solidity: based on solhint default, though with some rules disabled.
