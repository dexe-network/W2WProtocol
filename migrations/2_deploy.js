const delay = require('delay');

const BuyBacker = artifacts.require('BuyBacker');
const UserWalletFactory = artifacts.require('UserWalletFactory');
const Wallet2Wallet = artifacts.require('Wallet2Wallet');
const Estimator = artifacts.require('Estimator');

const BSCBuyBacker = artifacts.require('BSCBuyBacker');
const BSCWallet2Wallet = artifacts.require('BSCWallet2Wallet');

const wait = async (param) => {console.log(`Mined: ${param}`); await delay(1000);};

module.exports = async function (deployer, network) {
  let buyBacker;
  if (network == 'bsc') {
    await deployer.deploy(BSCBuyBacker);
    buyBacker = await BSCBuyBacker.deployed();
  } else {
    await deployer.deploy(BuyBacker);
    buyBacker = await BuyBacker.deployed();
  }
  await wait(`BuyBacker contract mined ${buyBacker.address}`);

  let wallet2Wallet;
  if (network == 'bsc') {
    await deployer.deploy(BSCWallet2Wallet, buyBacker.address);
    wallet2Wallet = await BSCWallet2Wallet.deployed();
  } else {
    await deployer.deploy(Wallet2Wallet, buyBacker.address);
    wallet2Wallet = await Wallet2Wallet.deployed();
  }
  await wait(`Wallet2Wallet contract mined ${wallet2Wallet.address}`);

  await deployer.deploy(Estimator);
  const estimator = await Estimator.deployed();
  await wallet2Wallet.grantRole(await wallet2Wallet.EXECUTOR_ROLE(), estimator.address);
  await wait(`Estimator contract mined ${estimator.address}`);
  if (process.env.MODE == '2to3') {
    return;
  }

  await deployer.deploy(UserWalletFactory);
  const userWalletFactory = await UserWalletFactory.deployed();
  await wait(`UserWalletFactory contract mined ${userWalletFactory.address}`);
}
