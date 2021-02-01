const BuyBacker = artifacts.require('BuyBacker');
const UserWalletFactory = artifacts.require('UserWalletFactory');
const Wallet2Wallet = artifacts.require('Wallet2Wallet');
const UserWallet = artifacts.require('UserWallet');
const Estimator = artifacts.require('Estimator');
const ERC20 = artifacts.require('ERC20');
const Token = artifacts.require('Token');
const UniRouter = artifacts.require('IUniswapV2Router02');

const truffleAssert = require('truffle-assertions');

const {bn, assertBNequal} = require('./helpers/utils');

contract('test', async (accounts) => {

  let buyBacker;
  let userWalletFactory;
  let wallet2Wallet;
  let token;
  let estimator;

  let weth;
  let uniRouter;
  let dai;
  let usdc;
  let dexe;

  const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
  const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  const dexeAddress = '0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6';
  const ZERO_BALANCE_ADDRESS = '0x22b04f58a35d82df5d714376caf218921f75cefb';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const GAS_PRICE = bn(20000000000);
  const FEE = 25; // 0.25%

  const EXECUTOR = accounts[0];
  const NOT_EXECUTOR = accounts[1];
  const NOT_OWNER = NOT_EXECUTOR;

  let nextAccount = 1;

  web3.eth.defaultAccount = accounts[0];

  before('setup', async () => {
    buyBacker = await BuyBacker.deployed();
    // await buyBacker.approveExchange([daiAddress, WETH_ADDRESS]);
    userWalletFactory = await UserWalletFactory.deployed();
    wallet2Wallet = await Wallet2Wallet.deployed();
    estimator = await Estimator.deployed();

    weth = await ERC20.at(WETH_ADDRESS);
    uniRouter = await UniRouter.at(routerAddress);
    dai = await ERC20.at(daiAddress);
    usdc = await ERC20.at(usdcAddress);
    dexe = await ERC20.at(dexeAddress);
  });

  const assertErrorReason = (actualResult, expectedReason) => {
    assert.isFalse(actualResult[0], 'Call did not fail');
    assert.equal(web3.utils.toAscii('0x' + actualResult[1].slice(138).replace(/00+$/, '')), expectedReason);
  };

  const assertErrorEvent = (actualResult, expectedReason) => {
    const logs = actualResult.logs.filter(event => event.event === 'Error');
    assert.isTrue(logs.length > 0, 'No Error events found');
    const log = logs[0];
    assert.equal(web3.utils.toAscii('0x' + log.args._error.slice(138).replace(/00+$/, '')), expectedReason);
  };

  const buyAndBurn = async () => {
    await wallet2Wallet.sendFeesToBuyBacker([daiAddress, ETH_ADDRESS, WETH_ADDRESS, dexeAddress]);
    // await buyBacker.buyBack([daiAddress, ETH_ADDRESS, WETH_ADDRESS]);
  };

  describe('Wallet2Wallet', async () => {
    it('should swap eth to token', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});
      // const tSBefore = await dexe.totalSupply();

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, FEE, false, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const tSAfter = await dexe.totalSupply();

      // assert.isTrue(tSBefore.gt(tSAfter));
      assert.isTrue((await dai.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dexe.balanceOf(wallet2Wallet.address)), bn(0));
    });

    it('should be possible to swap eth to token without burn fee and dexe is not burned if fee is set to 0', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const zeroFee = 0;
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});
      const buybackDexeBefore = await dexe.balanceOf(buyBacker.address);

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, zeroFee, false, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      // const tSAfter = await dexe.totalSupply();

      // assert.isTrue(buybackDexeBefore.eq(tSAfter));

      assert.isTrue((await dai.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dexe.balanceOf(buyBacker.address)), buybackDexeBefore);
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    });

    it('should be possible to swap weth (direct pair)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assert.isTrue((await weth.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    });

    it.skip('should be possible to estimate swaps', async () => {
      await wallet2Wallet.grantRole(await wallet2Wallet.EXECUTOR_ROLE(), estimator.address);
      const user = accounts[nextAccount++ +1];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      const data = wallet2Wallet.contract.methods.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()]).encodeABI();
      const estimate = await estimator.estimate.call(wallet2Wallet.address, data, {gas: bn(3000000)});
      const estimate2 = await estimator.estimate.estimateGas(wallet2Wallet.address, data, {gas: bn(3000000)});
      assert.isTrue(bn(estimate2).gt(estimate));
      console.log(estimate.toString(), estimate2.toString());
      await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, estimate.add(bn(30000)),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: estimate.add(bn(30000))});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assert.isTrue((await weth.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    });

    it('should be possible to swap weth (direct pair) without burn fee and dexe is not burned if fee is set to 0', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      const zeroFee = 0;
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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
      assertBNequal(await weth.balanceOf(userWallet.address), 0);

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);
      // await dai.approve(uniRouter.address, daiAmount, {from: user});

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, zeroFee, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
      assert.isTrue((await weth.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
    });

    it('should NOT be possible to swap via makeSwapETHForTokens on w2w weth (direct pair) if user fee more than allowed provided', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const highFee = 51; // 0.51%;
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});
      // const tSBefore = await dexe.totalSupply();

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);

      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) == executorBalanceBefore);

      await truffleAssert.reverts(
        wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, highFee, false, bn(3000000),
          uniRouter.address,
          uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Fee is too high'
      )
    });

    it('should NOT be possible to swap via makeSwap on w2w weth (direct pair) if not enough tokens on user account', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount.add(bn(1)), {from: user});

      const result = await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount.add(bn(1)), weth.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)})

      assertErrorEvent(result, 'ERC20 transferFrom failed');

      assertBNequal((await dai.balanceOf(user)), daiAmount);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
    });


    it('should NOT be possible to swap via makeSwap on w2w weth (direct pair) if user fee more than allowed provided', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      const highFee = 51; // 0.51%

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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      await truffleAssert.reverts(
        wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, highFee, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'Fee is too high'
      );
    });

    it('should NOT be possible to swap via makeSwap on w2w weth (direct pair) if not enough tokens inside uniswap swapExactTokensForTokens call data', async () => {
      const user = accounts[nextAccount++ +6];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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
      // await dai.approve(uniRouter.address, daiAmount, {from: user});

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      // const result = await wallet2Wallet.makeSwap.call([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
      //   routerAddress, routerAddress,
      //   uniRouter.contract.methods.swapExactTokensForTokens(daiAmount.add(bn(1)), 0, [dai.address, weth.address],
      //     wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
      //   {gas: bn(3000000)});

      // seems that ganache is broken.
      // assertErrorReason(result, 'TransferHelper: TRANSFER_FROM_FAILED');

      const result = await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount.add(bn(1)), 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)})
      assertErrorEvent(result, 'TransferHelper: TRANSFER_FROM_FAILED');

      assertBNequal((await dai.balanceOf(user)), daiAmount);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
    });


    it('should be possible to swap token to eth (direct pair)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.gt(dexeSupplyAfter));
      assertBNequal((await weth.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) > 0);
    });

    it('should be possible to swap token to eth (direct pair) without burn fee and dexe is not burned if fee is set to 0', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      const zeroFee = 0;
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, zeroFee, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
      assertBNequal((await weth.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dai.balanceOf(user)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) > 0);
    });

    it('should NOT be possible to swap token to eth (direct pair) via makeSwapTokensForETH on w2w if not enough tokens on user account', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount.add(bn(1)), {from: user});

      const result = await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount.add(bn(1)), 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});

      assertErrorEvent(result, 'ERC20 transferFrom failed');
      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
    });

    it('should NOT be possible to swap token to eth (direct pair) via makeSwapTokensForETH on w2w if not enough tokens inside uniswap swapExactTokensForETH call data', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount.add(bn(1)), {from: user});

      const result = await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount.add(bn(1)), 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});

      assertErrorEvent(result, 'TransferHelper: TRANSFER_FROM_FAILED');
      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      // assert.isTrue(dexeSupplyBefore.eq(dexeSupplyAfter));
    });

    it('should NOT be possible to swap token to eth (direct pair) via makeSwapTokensForETH on w2w if user fee more than allowed provided', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      const highFee = 51; // 0.51%

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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      await truffleAssert.reverts(
        wallet2Wallet.makeSwapTokensForETH.call([userWallet.address, dai.address, daiAmount, 0, highFee, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Fee is too high'
      );
    });

    it('should be possible to swap dexe (burn dexe directly)', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await weth.approve(userWallet.address, wethAmount, {from: user});

      const buybackDexeBefore = await dexe.balanceOf(buyBacker.address);
      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, weth.address, wethAmount, dexe.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(wethAmount, 0, [weth.address, dexe.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const dexeSupplyAfter = await dexe.totalSupply();

      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(buybackDexeBefore));
      assert.isTrue((await dexe.balanceOf(userWallet.address)).gt(bn(0)));
      assertBNequal((await weth.balanceOf(user)), bn(0));
      assertBNequal((await weth.balanceOf(userWallet.address)), bn(0));
    });

    it('should return error reason from target call', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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
      // await dai.approve(uniRouter.address, daiAmount, {from: user});

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});
      const balanceBefore = await web3.eth.getBalance(userWallet.address);

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      // Using wrong uniswap path to get an error.
      const result = await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, '10000000000000000000000', [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assertErrorEvent(result, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      // const dexeSupplyAfter = await dexe.totalSupply();

      // assertBNequal(dexeSupplyBefore, dexeSupplyAfter);
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) < balanceBefore);
    });

    it('should return error reason from execution', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});
      const balanceBefore = await web3.eth.getBalance(userWallet.address);

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      // Using wrong uniswap path to get an error.
      const result = await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, '10000000000000000000000', FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assertErrorEvent(result, 'W2W:Less than minimum received');
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      // const dexeSupplyAfter = await dexe.totalSupply();

      // assertBNequal(dexeSupplyBefore, dexeSupplyAfter);
      assert.isTrue((await web3.eth.getBalance(userWallet.address)) < balanceBefore);
    });

    it('should swap to user address instead of wallet', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user, value: bn('10000000000000000000')});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      // const tSBefore = await dexe.totalSupply();

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, FEE, true, bn(3000000),
        uniRouter.address,
        uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await buyAndBurn();
      // const tSAfter = await dexe.totalSupply();

      // assert.isTrue(tSBefore.gt(tSAfter));
      assert.isTrue((await dai.balanceOf(user)).gt(bn(0)));
      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));
      assertBNequal((await dai.balanceOf(userWallet.address)), bn(0));
    });

    it('should swap to unknown token and send fee to buy backer', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('9000000000000000000');
      token = await Token.new(amount);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});

      await uniRouter.swapExactETHForTokens(amount, [weth.address, dai.address], EXECUTOR,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});
      await dai.transfer(userWallet.address, amount);
      await dai.approve(uniRouter.address, amount);
      await token.approve(uniRouter.address, amount);
      await uniRouter.addLiquidity(token.address, daiAddress, amount, amount, 1, 1, EXECUTOR, Date.now());

      // const tSBefore = await dexe.totalSupply();
      const buybackDexeBefore = await dexe.balanceOf(buyBacker.address);
      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, daiAddress, amount, token.address, 0, FEE, false, bn(3000000),
        uniRouter.address, uniRouter.address,
        uniRouter.contract.methods.swapExactTokensForTokens(amount, 0, [daiAddress, token.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);
      await wallet2Wallet.sendFeesToBuyBacker([token.address]);
      // const tSAfter = await dexe.totalSupply();

      // assertBNequal(tSBefore, tSAfter);
      assert.isTrue((await token.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await token.balanceOf(buyBacker.address)).gt(bn(0)));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dexe.balanceOf(buyBacker.address)), buybackDexeBefore);
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));

      // OneSplit fails to find a path Token -> Dai -> ETH -> Dexe.
      // console.log((await token.balanceOf(buyBacker.address)).toString());
      // await buyBacker.approveExchange([token.address]);
      // await buyBacker.buyBack([token.address]);

      // const tSAfterBurn = await dexe.totalSupply();
      // assert.isTrue(tSBefore.gt(tSAfterBurn));
    });

    it('should swap to unknown token and send dexe (deep swap) to buy backer', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('9000000');
      token = await Token.new(amount);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});

      await uniRouter.swapExactETHForTokens(amount, [weth.address, usdc.address], EXECUTOR,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: bn('1000000000000000000'), gas: bn(3000000)});
      await usdc.transfer(userWallet.address, amount);
      await usdc.approve(uniRouter.address, amount);
      await token.approve(uniRouter.address, amount);
      await uniRouter.addLiquidity(token.address, usdc.address, amount, amount, 1, 1, EXECUTOR, Date.now());

      // const tSBefore = await dexe.totalSupply();
      const buybackDexeBefore = await dexe.balanceOf(buyBacker.address);
      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, usdc.address, amount, token.address, 0, FEE, false, bn(3000000),
        uniRouter.address, uniRouter.address,
        uniRouter.contract.methods.swapExactTokensForTokens(amount, 0, [usdc.address, token.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);
      // await wallet2Wallet.sendFeesToBuyBacker([token.address]);
      // const tSAfter = await dexe.totalSupply();

      // assertBNequal(tSBefore, tSAfter);
      assert.isTrue((await token.balanceOf(userWallet.address)).gt(bn(0)));
      assert.isTrue((await dexe.balanceOf(buyBacker.address)).gt(buybackDexeBefore));
      assertBNequal((await dai.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await token.balanceOf(buyBacker.address)), bn(0));
      assertBNequal((await dexe.balanceOf(userWallet.address)), bn(0));

      // OneSplit fails to find a path Token -> Dai -> ETH -> Dexe.
      // console.log((await token.balanceOf(buyBacker.address)).toString());
      // await buyBacker.approveExchange([token.address]);
      // await buyBacker.buyBack([token.address]);

      // const tSAfterBurn = await dexe.totalSupply();
      // assert.isTrue(tSBefore.gt(tSAfterBurn));
    });

    it('should not be possible to swap eth to token for not executor', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      await weth.send(amount, {from: user});

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user});

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);

      await truffleAssert.reverts(
        wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {from: NOT_EXECUTOR, gas: bn(3000000)}),
        'W2W:Only Executor'
      );
    });

    it('should not be possible to swap eth to token if user wallet does not have enough ETH', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(3000000).mul(GAS_PRICE).sub(bn(1));
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      await weth.send(amount, {from: user});

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user});

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);

      await truffleAssert.reverts(
        wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Not enough ETH in UserWallet'
      );
    });

    it('should not be possible to makeSwapETHForTokens for not executor', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);
      await userWallet.send(bn('10000000000000000000'), {from: user});

      await truffleAssert.reverts(
        wallet2Wallet.makeSwapETHForTokens([userWallet.address, amount, daiAddress, 0, FEE, false, bn(3000000),
          uniRouter.address,
          uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {from: NOT_EXECUTOR, gas: bn(3000000)}),
        'W2W:Only Executor'
      );
    });

    it('should not be possible to makeSwapETHForTokens if user wallet does not have enough ETH', async () => {
      const user = accounts[nextAccount++];
      const amountFrom = bn(9000000000000000000);
      const amount = bn(3000000).mul(GAS_PRICE).add(amountFrom).sub(bn(1));
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});


      await truffleAssert.reverts(
        wallet2Wallet.makeSwapETHForTokens([userWallet.address, amountFrom, daiAddress, 0, FEE, false, bn(3000000),
          uniRouter.address,
          uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Not enough ETH in UserWallet'
      );
    });

    it('should not be possible to makeSwapTokensForETH for not executor', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      await weth.send(amount, {from: user});

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user});

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);

      await truffleAssert.reverts(
        wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {from: NOT_EXECUTOR, gas: bn(3000000)}),
        'W2W:Only Executor'
      );
    });

    it('should not be possible to makeSwapTokensForETH if user wallet does not have enough ETH', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(3000000).mul(GAS_PRICE).sub(bn(1));
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      await weth.send(amount, {from: user});

      // get dai (from token)
      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user});

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);

      await truffleAssert.reverts(
        wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Not enough ETH in UserWallet'
      );
    });

    it('should not be possible to call externally _execute, _executeETHForTokens, _executeTokensForETH from not W2W contract', async () => {
      const user = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      // get weth (to token)
      await weth.send(amount, {from: user});

      // get dai (from token)

      await weth.approve(uniRouter.address, amount, {from: user});
      await uniRouter.swapExactTokensForTokens(amount, 0, [weth.address, dai.address], user, Math.floor(Date.now() / 1000) + 86400, {from: user});

      // DAI to WETH
      const daiAmount = await dai.balanceOf(user);

      await truffleAssert.reverts(
        wallet2Wallet._execute([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Only this contract'
      );

      await truffleAssert.reverts(
        wallet2Wallet._executeETHForTokens([userWallet.address, amount, daiAddress, 0, FEE, false, bn(3000000),
          uniRouter.address,
          uniRouter.contract.methods.swapExactETHForTokens(0, [weth.address, daiAddress],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Only this contract'
      );

      await truffleAssert.reverts(
        wallet2Wallet._executeTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
          routerAddress, routerAddress,
          uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
            wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
          {gas: bn(3000000)}),
        'W2W:Only this contract'
      );
    });

    it('should be possible to collect tokens from W2W without touching fees', async () => {
      const user = accounts[nextAccount++];
      const receiver = accounts[nextAccount++];
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwap([userWallet.address, dai.address, daiAmount, weth.address, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForTokens(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await weth.send(amount, {from: user});
      await weth.transfer(wallet2Wallet.address, amount, {from: user});

      await truffleAssert.reverts(
        wallet2Wallet.collectTokens(weth.address, amount.add(bn(1)), receiver),
        'W2W:Insufficient extra tokens'
      );

      await wallet2Wallet.collectTokens(weth.address, amount, receiver),

      assertBNequal(await weth.balanceOf(wallet2Wallet.address), await wallet2Wallet.fees(weth.address));
      assertBNequal(await weth.balanceOf(receiver), amount);
    });

    it('should be possible to collect ETH from W2W without touching fees', async () => {
      const user = accounts[nextAccount++];
      const receiver = '0x000000000000000000000000000000000000cafe';
      const amount = bn('5000000000000000000');
      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
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

      // const dexeSupplyBefore = await dexe.totalSupply();

      await dai.approve(userWallet.address, daiAmount, {from: user});

      const executorBalanceBefore = await web3.eth.getBalance(EXECUTOR);
      await wallet2Wallet.makeSwapTokensForETH([userWallet.address, dai.address, daiAmount, 0, FEE, false, bn(3000000),
        routerAddress, routerAddress,
        uniRouter.contract.methods.swapExactTokensForETH(daiAmount, 0, [dai.address, weth.address],
          wallet2Wallet.address, Math.floor(Date.now() / 1000) + 86400).encodeABI()],
        {gas: bn(3000000)});
      assert.isTrue((await web3.eth.getBalance(EXECUTOR)) >= executorBalanceBefore);

      await wallet2Wallet.send(amount, {from: user});

      await truffleAssert.reverts(
        wallet2Wallet.collectTokens(ETH_ADDRESS, amount.add(bn(1)), receiver),
        'W2W:Insufficient extra ETH'
      );

      await wallet2Wallet.collectTokens(ETH_ADDRESS, amount, receiver),

      assertBNequal(await web3.eth.getBalance(wallet2Wallet.address), await wallet2Wallet.fees(ETH_ADDRESS));
      assertBNequal(await web3.eth.getBalance(receiver), amount);
    });

    it('should be possible to collect tokens from W2W', async () => {
      const user = accounts[nextAccount++];
      const receiver = accounts[nextAccount++];
      const amount = bn('5000000000000000000');

      // get weth (to token)
      await weth.send(amount, {from: user});

      await weth.transfer(wallet2Wallet.address, amount, {from: user});

      const w2wBalance = await weth.balanceOf(wallet2Wallet.address);
      assertBNequal(await weth.balanceOf(receiver), 0);

      await wallet2Wallet.collectTokens(weth.address, amount, receiver);


      assertBNequal(await weth.balanceOf(wallet2Wallet.address), w2wBalance.sub(amount));
      assertBNequal(await weth.balanceOf(receiver), amount);
    });

    it('should not be possible to collect tokens from W2W for not owner', async () => {
      const user = accounts[nextAccount++];
      const receiver = accounts[nextAccount++];
      const amount = bn('5000000000000000000');

      // get weth (to token)
      await weth.send(amount, {from: user});

      await weth.transfer(wallet2Wallet.address, amount, {from: user});

      const w2wBalance = await weth.balanceOf(wallet2Wallet.address);
      assertBNequal(await weth.balanceOf(receiver), 0);

      await truffleAssert.reverts(
        wallet2Wallet.collectTokens(weth.address, amount, receiver, {from: NOT_OWNER}),
        'W2W:Only owner'
      );
    });

    it('should be possible to collect ETH from W2W', async () => {
      const user = accounts[nextAccount++];
      const receiver = accounts[nextAccount++];
      const amount = bn('5000000000000000000');

      await wallet2Wallet.send(amount, {from: user});

      const receiverBalance = await web3.eth.getBalance(receiver);

      assertBNequal(await web3.eth.getBalance(wallet2Wallet.address), amount.add(bn(await wallet2Wallet.fees(ETH_ADDRESS))));

      await wallet2Wallet.collectTokens(ETH_ADDRESS, amount, receiver);

      assertBNequal(await web3.eth.getBalance(wallet2Wallet.address), await wallet2Wallet.fees(ETH_ADDRESS));
      assertBNequal(await web3.eth.getBalance(receiver), bn(receiverBalance).add(amount));
    });

    it('should not be possible to collect ETH from W2W for not owner', async () => {
      const user = accounts[nextAccount++];
      const receiver = accounts[nextAccount++];
      const amount = bn('5000000000000000000');

      await wallet2Wallet.send(amount, {from: user});

      const receiverBalance = await web3.eth.getBalance(receiver);

      assertBNequal(await web3.eth.getBalance(wallet2Wallet.address), amount.add(bn(await wallet2Wallet.fees(ETH_ADDRESS))));

      await truffleAssert.reverts(
        wallet2Wallet.collectTokens(ETH_ADDRESS, amount, receiver, {from: NOT_OWNER}),
        'W2W:Only owner'
      );
    });


  });

  describe('BuyBacker', async () => {
    it.skip('buyBack', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(1000000000000000000);

      await uniRouter.swapExactETHForTokens(amount, [weth.address, dai.address], user,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});
      await uniRouter.swapExactETHForTokens(amount, [weth.address, dexe.address], user,
        Math.floor(Date.now() / 1000) + 86400, {from: user, value: amount, gas: bn(3000000)});

      await dai.transfer(buyBacker.address, await dai.balanceOf(user), {from: user});
      // let tSBefore = await dexe.totalSupply();
      // await buyBacker.approveExchange([dai.address]);
      await buyBacker.buyBack([dai.address], ['0x']);
      // let tSAfter = await dexe.totalSupply();
      // assert.isTrue(tSBefore.gt(tSAfter));
      assertBNequal(await dai.balanceOf(buyBacker.address), 0);

      await dexe.transfer(buyBacker.address, amount, {from: user});
      // tSBefore = await dexe.totalSupply();
      await buyBacker.buyBack([dexe.address], ['0x']);
      // tSAfter = await dexe.totalSupply();
      // assert.isTrue(tSBefore.gt(tSAfter));

      await buyBacker.buyBack([weth.address]);
    });
  });

  describe('User wallet / user factory', async () => {
    it('should be possible to deploy user contract and send ether during deployment.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user, value: amount});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      assertBNequal(await web3.eth.getBalance(userWalletAddress), amount);
      assert.equal(await userWallet.owner(), user);
    });

    it('should be possible to deploy user contract for another user.', async () => {
      const user = accounts[nextAccount++];
      const anotherUser = accounts[nextAccount++];

      await userWalletFactory.deployUserWalletFor(wallet2Wallet.address, user, ZERO_ADDRESS, {from: anotherUser});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      assert.equal(await userWallet.owner(), user);
    });

    it('should not be possible to deploy 2nd user contract for user..', async () => {
      const user = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});

      await truffleAssert.reverts(
        userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user})
      );
    });

    it('user wallet should be able to receive ETH via direct send ETH.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      assertBNequal(await web3.eth.getBalance(userWalletAddress), 0);
      await userWallet.send(amount, {from: user});
      assertBNequal(await web3.eth.getBalance(userWalletAddress), amount);
    });

    it('should not be possible to demand ETH from not owner/w2w.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const notWalletOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      assertBNequal(await web3.eth.getBalance(userWalletAddress), 0);
      await userWallet.send(amount, {from: user});
      assertBNequal(await web3.eth.getBalance(userWalletAddress), amount);

      assertBNequal(await web3.eth.getBalance(ZERO_BALANCE_ADDRESS), 0);

      await truffleAssert.reverts(
        userWallet.demandETH(ZERO_BALANCE_ADDRESS, amount, {from: notWalletOwner}),
        'Only W2W or owner'
      );
    });

    it('should be possible to demand ETH from owner/w2w.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const wallet2WalletFake = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2WalletFake, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      assertBNequal(await web3.eth.getBalance(userWalletAddress), 0);
      await userWallet.send(amount, {from: user});
      assertBNequal(await web3.eth.getBalance(userWalletAddress), amount);

      assertBNequal(await web3.eth.getBalance(ZERO_BALANCE_ADDRESS), 0);
      await userWallet.demandETH(ZERO_BALANCE_ADDRESS, amount, {from: wallet2WalletFake});

      assertBNequal(await web3.eth.getBalance(userWalletAddress), 0);
      assertBNequal(await web3.eth.getBalance(ZERO_BALANCE_ADDRESS), amount);
    });

    it('should not be possible to demand tokens from not w2w/owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const notWalletOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(ZERO_BALANCE_ADDRESS), 0);

      await truffleAssert.reverts(
        userWallet.demandERC20(weth.address, ZERO_BALANCE_ADDRESS, amount, {from: notWalletOwner}),
        'Only W2W or owner'
      );
    });

    it('should be possible to demand tokens from w2w/owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(ZERO_BALANCE_ADDRESS), 0);
      await userWallet.demandERC20(weth.address, ZERO_BALANCE_ADDRESS, amount, {from: user});

      assertBNequal(await weth.balanceOf(userWalletAddress), 0);
      assertBNequal(await weth.balanceOf(ZERO_BALANCE_ADDRESS), amount);
    });

    it('should not be possible to change user wallet owner from not owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const notOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      const OWNER = web3.utils.fromAscii('OWNER');
      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(user, 64).toLowerCase());

      await truffleAssert.reverts(
        userWallet.changeOwner(notOwner, {from: notOwner}),
        'Only owner'
      );
    });

    it('should be possible to change user wallet owner from owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const newOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      const OWNER = web3.utils.fromAscii('OWNER');
      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(user, 64).toLowerCase())

      const result = await userWallet.changeOwner(newOwner, {from: user});

      const newOwnerBytes = web3.utils.padLeft(newOwner, 64).toLowerCase();

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'ParamUpdated');
      assert.equal(result.logs[0].args._key, web3.utils.padRight(OWNER, 64).toLowerCase());
      assert.equal(result.logs[0].args._value, newOwnerBytes);

      assert.equal(await userWallet.params(OWNER), newOwnerBytes)
    });

    it('should not be possible to change param from not owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const notOwner = accounts[nextAccount++];
      const newW2w = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      const W2W = web3.utils.fromAscii('W2W');
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(wallet2Wallet.address, 64).toLowerCase());


      await truffleAssert.reverts(
        userWallet.changeParam(W2W, web3.utils.padLeft(newW2w, 64).toLowerCase(), {from: notOwner}),
        'Only owner'
      );
    });

    it('should not be possible to change referrer.', async () => {
      const user = accounts[nextAccount++];
      const referrer = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, referrer, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      const REFERRER = web3.utils.fromAscii('REFERRER');
      assert.equal(await userWallet.params(REFERRER), web3.utils.padLeft(referrer, 64).toLowerCase());

      await truffleAssert.reverts(
        userWallet.changeParam(REFERRER, web3.utils.padLeft(user, 64).toLowerCase(), {from: user}),
        'Cannot update referrer'
      );
    });

    it('should be possible to change param from owner.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const newW2w = accounts[nextAccount++];


      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await userWallet.send(amount, {from: user});

      const W2W = web3.utils.fromAscii('W2W');
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(wallet2Wallet.address, 64).toLowerCase())

      const result = await userWallet.changeParam(W2W, web3.utils.padLeft(newW2w, 64).toLowerCase(), {from: user});

      const newW2wBytes = web3.utils.padLeft(newW2w, 64).toLowerCase();

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'ParamUpdated');
      assert.equal(result.logs[0].args._key, web3.utils.padRight(W2W, 64).toLowerCase());
      assert.equal(result.logs[0].args._value, newW2wBytes);

      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(newW2w, 64).toLowerCase())
    });

    it('should not be possible to demand custom tokens from not w2w/owner via demand() func ', async () => {
      const user = accounts[nextAccount++];
      const WETH_ZERO_BALANCE_DEMAND = '0xb7e0b2c334c7cebff36fb2ec38c364971630de3d';
      const amount = bn(9000000000000000000);
      const notOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND), 0);

      const data = weth.contract.methods.transfer(WETH_ZERO_BALANCE_DEMAND, amount).encodeABI();

      await truffleAssert.reverts(
        userWallet.demand(weth.address, 0, data, {from: notOwner}),
        'Only W2W or owner'
      );
    });

    it('should be possible to demand custom tokens from w2w/owner via demand() func ', async () => {
      const user = accounts[nextAccount++];
      const WETH_ZERO_BALANCE_DEMAND = '0xb7e0b2c334c7cebff36fb2ec38c364971630de3d';
      const amount = bn(9000000000000000000);

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND), 0);

      const data = weth.contract.methods.transfer(WETH_ZERO_BALANCE_DEMAND, amount).encodeABI();
      await userWallet.demand(weth.address, 0, data, {from: user});

      assertBNequal(await weth.balanceOf(userWalletAddress), 0);
      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND), amount);
    });

    it('should NOT be possible to demand multiple tokens from not w2w/owner via demandAll().', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const WETH_ZERO_BALANCE_DEMAND_ALL = '0xC9F34644A87ADA5A3DD828EAd834E969364ac861';
      const notOwner = accounts[nextAccount++];

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND_ALL), 0);

      await truffleAssert.reverts(
        userWallet.demandAll([weth.address], WETH_ZERO_BALANCE_DEMAND_ALL, {from: notOwner}),
        'Only W2W or owner'
      );
    });

    it('should be possible to demand multiple tokens from w2w/owner via demandAll().', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);
      const WETH_ZERO_BALANCE_DEMAND_ALL = '0xC9F34644A87ADA5A3DD828EAd834E969364ac861';

      await userWalletFactory.deployUserWallet(wallet2Wallet.address, ZERO_ADDRESS, {from: user});
      const userWalletAddress = await userWalletFactory.getUserWallet(user);
      const userWallet = await UserWallet.at(userWalletAddress);

      await weth.send(amount, {from: user});

      await weth.transfer(userWalletAddress, amount, {from: user});
      assertBNequal(await weth.balanceOf(userWalletAddress), amount);

      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND_ALL), 0);
      await userWallet.demandAll([weth.address, ETH_ADDRESS], WETH_ZERO_BALANCE_DEMAND_ALL, {from: user});

      assertBNequal(await weth.balanceOf(userWalletAddress), 0);
      assertBNequal(await weth.balanceOf(WETH_ZERO_BALANCE_DEMAND_ALL), amount);
    });

    it('should allow to deploy new UserWallet instance and init contract.', async () => {
      const user = accounts[nextAccount++];

      const userWallet = await UserWallet.new();

      const OWNER = web3.utils.fromAscii('OWNER');
      const W2W = web3.utils.fromAscii('W2W');

      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(ZERO_ADDRESS, 64).toLowerCase());
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(ZERO_ADDRESS, 64).toLowerCase());

      await userWallet.init(wallet2Wallet.address, user, ZERO_ADDRESS);

      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(user, 64).toLowerCase());
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(wallet2Wallet.address, 64).toLowerCase());
    });

    it('should allow to deploy new UserWallet instance and init contract with sending ETH in init.', async () => {
      const user = accounts[nextAccount++];
      const amount = bn(9000000000000000000);

      const userWallet = await UserWallet.new();

      const OWNER = web3.utils.fromAscii('OWNER');
      const W2W = web3.utils.fromAscii('W2W');

      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(ZERO_ADDRESS, 64).toLowerCase());
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(ZERO_ADDRESS, 64).toLowerCase());
      assertBNequal(await web3.eth.getBalance(userWallet.address), 0);

      await userWallet.init(wallet2Wallet.address, user, ZERO_ADDRESS, { value: amount });

      assertBNequal(await web3.eth.getBalance(userWallet.address), amount);
      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(user, 64).toLowerCase());
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(wallet2Wallet.address, 64).toLowerCase());
    });

    it('should not allow to init UserWallet contract 2nd time.', async () => {
      const user = accounts[nextAccount++];

      const userWallet = await UserWallet.new();

      const OWNER = web3.utils.fromAscii('OWNER');
      const W2W = web3.utils.fromAscii('W2W');

      await userWallet.init(wallet2Wallet.address, user, ZERO_ADDRESS);

      assert.equal(await userWallet.params(OWNER), web3.utils.padLeft(user, 64).toLowerCase());
      assert.equal(await userWallet.params(W2W), web3.utils.padLeft(wallet2Wallet.address, 64).toLowerCase());

      await truffleAssert.reverts(
        userWallet.init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS),
        'Already initialized'
      );
    });
  });
});
