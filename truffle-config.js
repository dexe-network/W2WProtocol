require('dotenv').config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const Web3 = require('web3');

web3 = new Web3();
const gasPrice = process.env.GAS_PRICE_GWEI ? web3.utils.toWei(process.env.GAS_PRICE_GWEI, 'gwei') : undefined;

module.exports = {
  plugins: ["solidity-coverage"],
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 12000000,
      gasPrice: 20000000000,
    },
    mainnet: { // truffle deploy --network mainnet --reset
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, process.env.RPC_URL),
      network_id: 1,
      gasPrice,
      gas: 6000000,
      skipDryRun: true,
    },
    bsc: { // truffle deploy --network bsc --reset
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, process.env.RPC_URL),
      network_id: 56,
      gasPrice,
      gas: 6000000,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      version: "0.7.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000000,
        },
      },
    },
  },
};
