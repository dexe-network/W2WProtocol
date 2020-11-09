const BuyBurner = artifacts.require('BuyBurner');
const UserWalletFactory = artifacts.require('UserWalletFactory');
const Wallet2Wallet = artifacts.require('Wallet2Wallet');
const UserWallet = artifacts.require('UserWallet');
const ERC20 = artifacts.require('ERC20');
const Token = artifacts.require('Token');
const UniRouter = artifacts.require('IUniswapV2Router02');

const {bn, assertBNequal} = require('./helpers/utils');

contract('test', async (accounts) => {

  let buyBurner;
  let userWalletFactory;
  let wallet2Wallet;
  let token;

  let weth;
  let uniRouter;
  let dai;
  let dexe;

  const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  const dexeAddress = '0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6';

  const EXECUTOR = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const USER3 = accounts[3];

  let nextAccount = 1;

  before('setup', async () => {
    buyBurner = await BuyBurner.deployed();
    userWalletFactory = await UserWalletFactory.deployed();
    wallet2Wallet = await Wallet2Wallet.deployed();

    weth = await ERC20.at(WETH_ADDRESS);
    uniRouter = await UniRouter.at(routerAddress);
    dai = await ERC20.at(daiAddress);
    dexe = await ERC20.at(dexeAddress);
  });

  const assertErrorReason = (actualResult, expectedReason) => {
    assert.isFalse(actualResult[0], 'Call did not fail');
    assert.equal(web3.utils.toAscii('0x' + actualResult[1].slice(138).replace(/00+$/, '')), expectedReason);
  };

  describe('Wallet2Wallet', async () => {
    it('should swap eth to token', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});
      const tSBefore = await dexe.totalSupply();

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, false, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const tSAfter = await dexe.totalSupply();

      assert.isTrue(tSBefore.gt(tSAfter));
      assert.isTrue((await dai.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBurner.address)), bn(0));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    })

    it('should be possible to swap weth/usdc (direct pair)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      assertBNequal(await weth.balanceOf(user), 0);
      await weth.send(amount, {from: user});
      assertBNequal(await weth.balanceOf(user), amount);

      // get dai (from token)
      assertBNequal(await dai.balanceOf(user), 0);

      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user})

      assertBNequal(await weth.balanceOf(user), 0);
      assert.isTrue((await dai.balanceOf(user)).gt(0));

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);
      await dai.approve(uniRouter.address, daiAmount, {from: user});

      const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const dexeSupplyAfter = await dexe.totalSupply();

      assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assert.isTrue((await weth.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    });

    it('should be possible to swap token to eth (direct pair)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      assertBNequal(await weth.balanceOf(user), 0);
      await weth.send(amount, {from: user});
      assertBNequal(await weth.balanceOf(user), amount);

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user})

      assertBNequal(await weth.balanceOf(user), 0);
      assert.isTrue((await dai.balanceOf(user)).gt(0));

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);
      await dai.approve(uniRouter.address, daiAmount, {from: user});

      const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const dexeSupplyAfter = await dexe.totalSupply();

      assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assertBNequal((await weth.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) > 0);
    });

    it('should be possible to swap dexe (burn dexe directly)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (from token)
      assertBNequal(await weth.balanceOf(user), 0);
      await weth.send(amount, {from: user});
      assertBNequal(await weth.balanceOf(user), amount);

      // WETH to DEXE
      const wethAmount = await weth.balanceOf(user);
      await weth.approve(uniRouter.address, wethAmount, {from: user});

      const dexeSupplyBefore = await dexe.totalSupply();

      await weth.approve(userWallet.address, wethAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, weth.address, wethAmount, dexe.address, 0, false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(wethAmount, 0, [weth.address, dexe.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const dexeSupplyAfter = await dexe.totalSupply();

      assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assert.isTrue((await dexe.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await weth.balanceOf(user)), bn(0));
      assertBNequal((await weth.balanceOf(userWallet.address)), bn(0));
    });

    it('should return error reason from target call', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      assertBNequal(await weth.balanceOf(user), 0);
      await weth.send(amount, {from: user});
      assertBNequal(await weth.balanceOf(user), amount);

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user})

      assertBNequal(await weth.balanceOf(user), 0);
      assert.isTrue((await dai.balanceOf(user)).gt(0));

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);
      await dai.approve(uniRouter.address, daiAmount, {from: user});

      const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});
      const balanceBefore = await web3.eth.getBalance(userWallet.address);

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      // Using wrong uniswap path to get an error.
      const result = await wallet2Wallet.makeSwapTokensForETH.call([userWallet.address, dai.address, daiAmount, 0, false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, '10000000000000000000000', [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});

      assertErrorReason(result, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, '10000000000000000000000', [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const dexeSupplyAfter = await dexe.totalSupply();

      assertBNequal(dexeSupplyBefore, dexeSupplyAfter);
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) < balanceBefore);
    });

    it('should return error reason from execution', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      assertBNequal(await weth.balanceOf(user), 0);
      await weth.send(amount, {from: user});
      assertBNequal(await weth.balanceOf(user), amount);

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user})

      assertBNequal(await weth.balanceOf(user), 0);
      assert.isTrue((await dai.balanceOf(user)).gt(0));

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);
      await dai.approve(uniRouter.address, daiAmount, {from: user});

      const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});
      const balanceBefore = await web3.eth.getBalance(userWallet.address);

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      // Using wrong uniswap path to get an error.
      const result = await wallet2Wallet.makeSwapTokensForETH.call([userWallet.address, dai.address, daiAmount, '10000000000000000000000', false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});

      assertErrorReason(result, 'Less than minimum received');
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, '10000000000000000000000', false, bn(3000000),
        routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const dexeSupplyAfter = await dexe.totalSupply();

      assertBNequal(dexeSupplyBefore, dexeSupplyAfter);
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) < balanceBefore);
    });

    it('should swap to user address instead of wallet', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user, value: bn('10000000000000000000')});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      const tSBefore = await dexe.totalSupply();

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, true, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      const tSAfter = await dexe.totalSupply();

      assert.isTrue(tSBefore.gt(tSAfter));
      assert.isTrue((await dai.balanceOf(user)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBurner.address)), bn(0));
      assertBNequal((await dexe.balanceOf(buyBurner.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
    });

    it('should swap to unknown token and send fee to buy burner', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('9000000000000000000');
      token = await Token.new(amount);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});

      await uniRouter.swapExactETHForTokens(amount, [weth.address, dai.address], EXECUTOR,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});
      await dai.transfer(userWallet.address, amount);
      await dai.approve(uniRouter.address, amount);
      await token.approve(uniRouter.address, amount);
      await uniRouter.addLiquidity(token.address, daiAddress, amount, amount, 1, 1, EXECUTOR, Date.now());

      const tSBefore = await dexe.totalSupply();
      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, daiAddress, amount, token.address, 0, false, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactTokensForTokens(amount, 0, [daiAddress, token.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);
      const tSAfter = await dexe.totalSupply();

      assertBNequal(tSBefore, tSAfter);
      assert.isTrue((await token.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await token.balanceOf(buyBurner.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBurner.address)), bn(0));
      assertBNequal((await dexe.balanceOf(buyBurner.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));

      // OneSplit fails to find a path Token -> Dai -> ETH -> Dexe.
      // console.log((await token.balanceOf(buyBurner.address)).toString());
      // await buyBurner.approveExchange([token.address]);
      // await buyBurner.buyBurn([token.address]);

      // const tSAfterBurn = await dexe.totalSupply();
      // assert.isTrue(tSBefore.gt(tSAfterBurn));
    });
  });

  describe('BuyBurner', async () => {
    it('buyBurn', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(1000000000000000000);

      await uniRouter.swapExactETHForTokens(amount, [weth.address, dai.address], user,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});
      await uniRouter.swapExactETHForTokens(amount, [weth.address, dexe.address], user,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});

      await dai.transfer(buyBurner.address, await dai.balanceOf(user), {from: user});
      let tSBefore = await dexe.totalSupply();
      await buyBurner.approveExchange([dai.address]);
      await buyBurner.buyBurn([dai.address]);
      let tSAfter = await dexe.totalSupply();
      assert.isTrue(tSBefore.gt(tSAfter));
      assertBNequal(await dai.balanceOf(buyBurner.address), 0);

      await dexe.transfer(buyBurner.address, amount, {from: user});
      tSBefore = await dexe.totalSupply();
      await buyBurner.buyBurn([dexe.address]);
      tSAfter = await dexe.totalSupply();
      assert.isTrue(tSBefore.gt(tSAfter));
    });
  });
});
