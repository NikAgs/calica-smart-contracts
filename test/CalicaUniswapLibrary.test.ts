import { expect } from "chai";
import { ethers, network } from "hardhat";

const ERC20ABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json")
  .abi;

// Runs only on forked mainnet
describe.only("TestCalicaExpenseUniswap", function() {
  before(async function() {
    this.oceanHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.oceanAddress = "0x967da4048cd07ab37855c090aaf366e4ce1b9f48";

    this.daiHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

    this.usdcHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    this.tetherHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.tetherAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";

    this.wethHolder = "0xd292b72e5c787f9f7e092ab7802addf76930981f";
    this.wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  });

  // Create a brand new TestCalicaExpenseUniswap contract before each test
  // Send Eth, DAI, and USDC to initialize contract balances
  beforeEach(async function() {
    // Reset hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env["ETHEREUM_ALCHEMY_URL"] as string,
            blockNumber: 15792160,
          },
        },
      ],
    });

    let signers = await ethers.getSigners();
    this.moneySender = signers[0];
    this.splitReceiver = signers[1];

    // Deploy the TestCalicaExpenseUniswap contract + library
    const CalicaUniswapLibrary = await ethers.getContractFactory(
      "CalicaUniswapLibrary"
    );
    const calicaUniswapLibrary = await CalicaUniswapLibrary.deploy();
    await calicaUniswapLibrary.deployed();
    this.TestCalicaUniswapLibrary = await ethers.getContractFactory(
      "TestCalicaUniswapLibrary",
      {
        libraries: {
          CalicaUniswapLibrary: calicaUniswapLibrary.address,
        },
      }
    );
    this.testCalicaUniswapLibrary = await this.TestCalicaUniswapLibrary.deploy();
    await this.testCalicaUniswapLibrary.deployed();

    // Send Eth to the contract
    await this.moneySender.sendTransaction({
      to: this.testCalicaUniswapLibrary.address,
      value: ethers.utils.parseEther("10"),
    });

    // Create the Dai Contract instance and send DAI to the contract
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.daiHolder],
    });
    let impersonateDaiHolder = await ethers.getSigner(this.daiHolder);
    this.daiContract = new ethers.Contract(
      this.daiAddress,
      ERC20ABI,
      impersonateDaiHolder
    );
    let tx = await this.daiContract
      .connect(impersonateDaiHolder)
      .transfer(this.testCalicaUniswapLibrary.address, 1000000n);

    await tx.wait();

    // Create the USDC Contract instance and send USDC to the contract
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.usdcHolder],
    });
    let impersonateUSDCHolder = await ethers.getSigner(this.usdcHolder);
    this.usdcContract = new ethers.Contract(
      this.usdcAddress,
      ERC20ABI,
      impersonateUSDCHolder
    );
    tx = await this.usdcContract
      .connect(impersonateUSDCHolder)
      .transfer(this.testCalicaUniswapLibrary.address, 1000000n);
    await tx.wait();

    // // Create the WETH Contract instance and send WETH to the contract
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.wethHolder],
    });
    let impersonateWETHHolder = await ethers.getSigner(this.wethHolder);
    this.wethContract = new ethers.Contract(
      this.wethAddress,
      ERC20ABI,
      impersonateWETHHolder
    );
    tx = await this.wethContract
      .connect(impersonateWETHHolder)
      .transfer(this.testCalicaUniswapLibrary.address, 1000n);
    await tx.wait();
  });

  it("swaps USDC for DAI", async function() {
    await checkDaiUSDCBalances.bind(this)(
      "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168",
      206647945695359117090472571n,
      211371747893424n
    );
    await checkDaiUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      1000000n,
      1000000n
    );
    await checkDaiUSDCBalances.bind(this)(this.splitReceiver.address, 0n, 0n);

    const latestBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(latestBlock)).timestamp;

    let res = await this.testCalicaUniswapLibrary.testPerformSwaps([
      {
        tokenIn: this.usdcAddress,
        tokenOut: this.daiAddress,
        fee: 100,
        recipient: this.splitReceiver.address,
        deadline: timestamp + 1000,
        amountIn: 1000000n,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ]);

    await checkDaiUSDCBalances.bind(this)(
      "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168",
      206647944695463719024411733n,
      211371748893424n
    );
    await checkDaiUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      1000000n,
      0n
    );
    await checkDaiUSDCBalances.bind(this)(
      this.splitReceiver.address,
      999895398066060838n,
      0n
    );
  });

  it("swaps USDC for ETH", async function() {
    await checkEthUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      10000000000000000000n,
      1000000n
    );
    await checkEthUSDCBalances.bind(this)(
      this.splitReceiver.address,
      10000000000000000000000n,
      0n
    );

    const latestBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(latestBlock)).timestamp;

    let res = await this.testCalicaUniswapLibrary.testPerformSwaps([
      {
        tokenIn: this.usdcAddress,
        tokenOut: ethers.constants.AddressZero,
        fee: 3000,
        recipient: this.splitReceiver.address,
        deadline: timestamp + 1000,
        amountIn: 10n,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ]);

    await checkEthUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      10000000000000000000n,
      999990n
    );
    await checkEthUSDCBalances.bind(this)(
      this.splitReceiver.address,
      10000000000007009426685n,
      0n
    );
  });

  it("swaps ETH for DAI", async function() {
    await checkEthDaiBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      10000000000000000000n,
      1000000n
    );
    await checkEthDaiBalances.bind(this)(
      this.splitReceiver.address,
      10000000000000000000000n,
      0n
    );

    const latestBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(latestBlock)).timestamp;

    let res = await this.testCalicaUniswapLibrary.testPerformSwaps([
      {
        tokenIn: ethers.constants.AddressZero,
        tokenOut: this.daiContract.address,
        fee: 3000,
        recipient: this.splitReceiver.address,
        deadline: timestamp + 1000,
        amountIn: 10n,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ]);

    await checkEthDaiBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      9999999999999999990n,
      1000000n
    );
    await checkEthDaiBalances.bind(this)(
      this.splitReceiver.address,
      10000000000000000000000n,
      11551n
    );
  });

  it("can do multiple swaps", async function() {
    await checkEthUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      10000000000000000000n,
      1000000n
    );
    await checkEthUSDCBalances.bind(this)(
      this.splitReceiver.address,
      10000000000000000000000n,
      0n
    );
    await checkDaiUSDCBalances.bind(this)(this.splitReceiver.address, 0n, 0n);

    const latestBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(latestBlock)).timestamp;

    let res = await this.testCalicaUniswapLibrary.testPerformSwaps([
      {
        tokenIn: this.usdcAddress,
        tokenOut: this.daiAddress,
        fee: 100,
        recipient: this.splitReceiver.address,
        deadline: timestamp + 1000,
        amountIn: 1000000n,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
      {
        tokenIn: ethers.constants.AddressZero,
        tokenOut: this.daiContract.address,
        fee: 3000,
        recipient: this.splitReceiver.address,
        deadline: timestamp + 1000,
        amountIn: 10n,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ]);

    await checkEthUSDCBalances.bind(this)(
      this.testCalicaUniswapLibrary.address,
      9999999999999999990n,
      0n
    );
    await checkEthUSDCBalances.bind(this)(
      this.splitReceiver.address,
      10000000000000000000000n,
      0n
    );
    await checkDaiUSDCBalances.bind(this)(
      this.splitReceiver.address,
      999895398066072389n,
      0n
    );
  });

  it("fails with invalid uniswap params", async function() {
    const latestBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(latestBlock)).timestamp;

    try {
      let res = await this.testCalicaUniswapLibrary.testPerformSwaps([
        {
          tokenIn: this.usdcAddress,
          tokenOut: this.daiAddress,
          fee: 34,
          recipient: this.splitReceiver.address,
          deadline: timestamp + 1000,
          amountIn: 1000000n,
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
        },
      ]);
    } catch (err) {
      expect(err.message).to.include("Transaction reverted");
    }
  });

  // Helper functions
  async function checkDaiUSDCBalances(
    this: Mocha.Context,
    address: string,
    daiBalance: bigint,
    usdcBalance: bigint
  ) {
    let actualDaiBalance = await this.daiContract.balanceOf(address);
    let actualUSDCBalance = await this.usdcContract.balanceOf(address);

    expect(actualDaiBalance).to.equal(daiBalance);
    expect(actualUSDCBalance).to.equal(usdcBalance);
  }

  async function checkWethUSDCBalances(
    this: Mocha.Context,
    address: string,
    wethBalance: bigint,
    usdcBalance: bigint
  ) {
    let actualWethBalance = await this.wethContract.balanceOf(address);
    let actualUSDCBalance = await this.usdcContract.balanceOf(address);

    expect(actualWethBalance).to.equal(wethBalance);
    expect(actualUSDCBalance).to.equal(usdcBalance);
  }

  async function checkEthUSDCBalances(
    this: Mocha.Context,
    address: string,
    ethBalance: bigint,
    usdcBalance: bigint
  ) {
    let actualEthBalance = await ethers.provider.getBalance(address);
    let actualUSDCBalance = await this.usdcContract.balanceOf(address);

    expect(actualEthBalance).to.equal(ethBalance);
    expect(actualUSDCBalance).to.equal(usdcBalance);
  }

  async function checkEthDaiBalances(
    this: Mocha.Context,
    address: string,
    ethBalance: bigint,
    daiBalance: bigint
  ) {
    let actualEthBalance = await ethers.provider.getBalance(address);
    let actualDAIBalance = await this.daiContract.balanceOf(address);

    expect(actualEthBalance).to.equal(ethBalance);
    expect(actualDAIBalance).to.equal(daiBalance);
  }

  async function checkBalance(
    this: Mocha.Context,
    address: string,
    token: string,
    expectedBalance: bigint
  ) {
    switch (token) {
      case "ETH":
        const balance = await ethers.provider.getBalance(address);
        expect(balance).to.equal(expectedBalance);
        break;
      case "USDC":
        const usdcBalance = await this.usdcContract.balanceOf(address);
        expect(usdcBalance).to.equal(expectedBalance);
        break;
      case "DAI":
        const daiBalance = await this.daiContract.balanceOf(address);
        expect(daiBalance).to.equal(expectedBalance);
      case "WETH":
        const wethBalance = await this.wethContract.balanceOf(address);
        expect(wethBalance).to.equal(expectedBalance);
    }
  }
});
