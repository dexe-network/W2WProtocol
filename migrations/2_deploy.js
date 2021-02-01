const delay = require('delay');

const BuyBacker = artifacts.require('BuyBacker');
const UserWalletFactory = artifacts.require('UserWalletFactory');
const Wallet2Wallet = artifacts.require('Wallet2Wallet');
const Estimator = artifacts.require('Estimator');

const wait = async (param) => {console.log(`Mined: ${param}`); await delay(1000);};

module.exports = async function (deployer) {
  await deployer.deploy(BuyBacker);
  const buyBacker = await BuyBacker.deployed();
  await wait(`BuyBacker contract mined ${buyBacker.address}`);

  await deployer.deploy(Wallet2Wallet, buyBacker.address);
  const wallet2Wallet = await Wallet2Wallet.deployed();
  await wait(`Wallet2Wallet contract mined ${wallet2Wallet.address}`);

  await deployer.deploy(UserWalletFactory);
  const userWalletFactory = await UserWalletFactory.deployed();
  await wait(`UserWalletFactory contract mined ${userWalletFactory.address}`);

  await deployer.deploy(Estimator);
  const estimator = await Estimator.deployed();
  await wait(`Estimator contract mined ${estimator.address}`);
}
