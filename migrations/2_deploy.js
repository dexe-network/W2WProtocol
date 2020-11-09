const delay = require('delay');

const BuyBurner = artifacts.require('BuyBurner');
const UserWalletFactory = artifacts.require('UserWalletFactory');
const Wallet2Wallet = artifacts.require('Wallet2Wallet');

const wait = async (param) => {console.log(`Mined: ${param}`); await delay(1000);};

module.exports = async function (deployer) {
  await deployer.deploy(BuyBurner);
  const buyBurner = await BuyBurner.deployed();
  await wait(`BuyBurner contract mined ${buyBurner.address}`);

  await deployer.deploy(Wallet2Wallet, buyBurner.address);
  const wallet2Wallet = await Wallet2Wallet.deployed();
  await wait(`Wallet2Wallet contract mined ${wallet2Wallet.address}`);

  await deployer.deploy(UserWalletFactory);
  const userWalletFactory = await UserWalletFactory.deployed();
  await wait(`UserWalletFactory contract mined ${userWalletFactory.address}`);
}
