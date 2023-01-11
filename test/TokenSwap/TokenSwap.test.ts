import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

const ERC20ABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json")
  .abi;

describe.only("TokenSwap", function() {
  // Initialize global test variables
  before(async function() {
    this.TokenSwap = await ethers.getContractFactory("TokenSwap");

    this.usdcHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    this.oceanHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.oceanAddress = "0x967da4048cD07aB37855c090aAF366e4ce1b9F48";
    this.daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    this.wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    this.calicaFeeAddress = "0xAb0279E49891416EADA65e36aE1AEd1A67A15d24";

    let signers = await ethers.getSigners();
    this.moneySender = signers[0];
    this.adam = signers[1];
    this.nik = signers[2];
    this.owner = signers[3];
    this.profitAddress = signers[4];
  });

  // Create a brand new TokenSwap contract before each test
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

    this.tokenSwap = await this.TokenSwap.deploy();
    await this.tokenSwap.deployed();
  });

  it("fails to initialize with invalid pool configs", async function() {
    try {
      await this.tokenSwap.initialize(
        {
          contractName: "Invalid Token Swap",
          tokenIn: ethers.constants.AddressZero,
          tokenOut: "0x99BB44964caEb93bC862a60b89173b934d99bAE7", // Random Address
          profitAddress: this.profitAddress.address,
          poolFee: 500,
          slippage: 0,
          wethAddress: this.wethAddress,
        },
        this.owner.address,
        false,
        true,
        0
      );

      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Invalid Uniswap pool");
    }
  });

  it("fails to swap before being initialized", async function() {
    try {
      await this.tokenSwap.swap();
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("No pool configured");
    }
  });

  it("fails to withdraw when non-owner calls it", async function() {
    await initializeValidTokenSwap.bind(this)();

    try {
      await this.tokenSwap
        .connect(this.adam)
        .withdrawTokens(["0x0000000000000000000000000000000000000000"]);
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Only owner can withdraw");
    }
  });

  it("fails to reconfigure before being initialized", async function() {
    try {
      await this.tokenSwap.reconfigure(
        this.profitAddress.address,
        ethers.constants.AddressZero,
        this.usdcAddress,
        500
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure when flag is set to false", async function() {
    await initializeValidTokenSwap.bind(this)();

    try {
      await this.tokenSwap.reconfigure(
        this.profitAddress.address,
        ethers.constants.AddressZero,
        this.usdcAddress,
        500
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure when non-owner calls it", async function() {
    await initializeValidTokenSwap.bind(this)(true);

    try {
      await this.tokenSwap
        .connect(this.adam)
        .reconfigure(
          this.profitAddress.address,
          ethers.constants.AddressZero,
          this.usdcAddress,
          500
        );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Only owner can reconfigure");
    }
  });

  it("initialized all configs correctly", async function() {
    await initializeValidTokenSwap.bind(this)();

    let contractName = await this.tokenSwap.contractName();
    let tokenIn = await this.tokenSwap.tokenIn();
    let tokenOut = await this.tokenSwap.tokenOut();
    let poolAddress = await this.tokenSwap.poolAddress();
    let profitAddress = await this.tokenSwap.profitAddress();
    let poolFee = await this.tokenSwap.poolFee();
    let reconfigurable = await this.tokenSwap.isReconfigurable();
    let isPush = await this.tokenSwap.isPush();
    let owner = await this.tokenSwap.owner();
    let calicaFee = await this.tokenSwap.calicaFee();
    let slippage = await this.tokenSwap.slippage();
    let wethAddress = await this.tokenSwap.weth9();

    expect(contractName).to.equal("Valid Token Swap");
    expect(tokenIn).to.equal(ethers.constants.AddressZero);
    expect(tokenOut).to.equal(this.usdcAddress);
    expect(profitAddress).to.equal(this.profitAddress.address);
    expect(poolFee).to.equal(500);
    expect(reconfigurable).to.equal(false);
    expect(isPush).to.equal(true);
    expect(owner).to.equal(this.owner.address);
    expect(calicaFee).to.equal(0);
    expect(slippage).to.equal(0);
    expect(wethAddress).to.equal(this.wethAddress);

    expect(poolAddress).to.equal("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640");
  });

  it("can reconfigure pool and profitAddress correctly", async function() {
    await initializeValidTokenSwap.bind(this)(true);

    let initialPoolAddress = await this.tokenSwap.poolAddress();

    await this.tokenSwap
      .connect(this.owner)
      .reconfigure(
        this.profitAddress.address,
        this.daiAddress,
        this.usdcAddress,
        500
      );

    let newPoolAddress = await this.tokenSwap.poolAddress();

    expect(initialPoolAddress).to.equal(
      "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"
    );
    expect(newPoolAddress).to.equal(
      "0x6c6Bc977E13Df9b0de53b251522280BB72383700"
    );
  });

  it("holds ETH when not a push contract", async function() {
    await initializeValidTokenSwap.bind(this)(false, false);

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.tokenSwap.address,
      value: ethers.utils.parseEther("3"),
    });

    await checkETHBalance(this.tokenSwap.address, 3000000000000000000n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);
  });

  it("allows owner to withdraw tokens", async function() {
    await initializeValidTokenSwap.bind(this)(false, true);
    await transferTokensToContract.bind(this)();

    await this.tokenSwap
      .connect(this.owner)
      .withdrawTokens([this.usdcAddress, this.oceanAddress]);

    await checkERC20Balance(this.usdcContract, this.owner.address, 1000000n);
    await checkERC20Balance(this.usdcContract, this.tokenSwap.address, 0n);
    await checkERC20Balance(this.oceanContract, this.owner.address, 1000000n);
    await checkERC20Balance(this.oceanContract, this.tokenSwap.address, 0n);
  });

  it("can swap ETH on receive", async function() {
    await initializeValidTokenSwap.bind(this)();

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.tokenSwap.address,
      value: ethers.utils.parseEther("3"),
    });

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await checkERC20Balance(
      this.usdcContract,
      this.profitAddress.address,
      3852278128n
    );
  });

  it("will keep ETH that fails to swap", async function() {
    // Using the Ocean <-> Eth pool which has low liquidity
    await this.tokenSwap.connect(this.owner).initialize(
      {
        contractName: "Valid Token Swap",
        tokenIn: ethers.constants.AddressZero,
        tokenOut: this.oceanAddress,
        profitAddress: this.profitAddress.address,
        poolFee: 3000,
        slippage: 0,
        wethAddress: this.wethAddress,
      },
      this.owner.address,
      false,
      true,
      0
    );

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.tokenSwap.address,
      value: ethers.utils.parseEther("9000"),
    });

    await checkERC20Balance(this.oceanContract, this.profitAddress.address, 0n);
    await checkERC20Balance(this.oceanContract, this.tokenSwap.address, 0n);

    await checkETHBalance(this.tokenSwap.address, 9000000000000000000000n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);
  });

  it("can swap tokens", async function() {
    await this.tokenSwap.connect(this.owner).initialize(
      {
        contractName: "Valid Token Swap",
        tokenIn: this.usdcAddress,
        tokenOut: ethers.constants.AddressZero,
        profitAddress: this.profitAddress.address,
        poolFee: 500,
        slippage: 0,
        wethAddress: this.wethAddress,
      },
      this.owner.address,
      false,
      true,
      0
    );

    await checkERC20Balance(this.usdcContract, this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await transferTokensToContract.bind(this)();
    await checkERC20Balance(
      this.usdcContract,
      this.tokenSwap.address,
      1000000n
    );

    await this.tokenSwap.connect(this.owner).swap();

    await checkERC20Balance(this.usdcContract, this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000777978304173120n);
  });

  it("pays out calica fee", async function() {
    await initializeValidTokenSwap.bind(this)(false, true, 100);

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);
    await checkERC20Balance(this.usdcContract, this.profitAddress.address, 0n);

    let initialCalicaBalance = await ethers.provider.getBalance(
      this.calicaFeeAddress
    );

    await this.moneySender.sendTransaction({
      to: this.tokenSwap.address,
      value: ethers.utils.parseEther("3"),
    });

    await checkETHBalance(this.tokenSwap.address, 0n);
    await checkETHBalance(this.profitAddress.address, 10000000000000000000000n);

    await checkETHBalance(
      this.calicaFeeAddress,
      initialCalicaBalance.toBigInt() + 30000000000000000n
    );
    await checkERC20Balance(
      this.usdcContract,
      this.profitAddress.address,
      3813755499n
    );
  });

  it("emits withdraw events correctly", async function() {
    await initializeValidTokenSwap.bind(this)(false, true, 100);

    await this.moneySender.sendTransaction({
      to: this.tokenSwap.address,
      value: ethers.utils.parseEther("10"),
    });

    let events = await getLogs(this.tokenSwap.address);
    expect(events.length).to.equal(2);
    expect(events[0].amount).to.equal(100000000000000000n);
    expect(events[0].account).to.equal(this.calicaFeeAddress);
    expect(events[0].tokenAddress).to.equal(ethers.constants.AddressZero);
    expect(events[1].amount).to.equal(12712401330n);
    expect(events[1].account).to.equal(this.profitAddress.address);
    expect(events[1].tokenAddress).to.equal(this.usdcAddress);
    expect(events[0].timestamp).to.equal(events[1].timestamp);
  });

  // helper function to set up an initialized token swap contract
  async function initializeValidTokenSwap(
    this: Mocha.Context,
    reconfigurable: boolean = false,
    isPush: boolean = true,
    calicaFee: number = 0
  ): Promise<void> {
    await this.tokenSwap.connect(this.owner).initialize(
      {
        contractName: "Valid Token Swap",
        tokenIn: ethers.constants.AddressZero,
        tokenOut: this.usdcAddress,
        profitAddress: this.profitAddress.address,
        poolFee: 500,
        slippage: 0,
        wethAddress: this.wethAddress,
      },
      this.owner.address,
      reconfigurable,
      isPush,
      calicaFee
    );
  }
});

// helper function to send some OCEAN and USDC to the contract
async function transferTokensToContract(this: Mocha.Context) {
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
  let tx = await this.usdcContract
    .connect(impersonateUSDCHolder)
    .transfer(this.tokenSwap.address, 1000000n);
  await tx.wait();

  // Create the Ocean Contract instance and send Ocean to the contract
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [this.oceanHolder],
  });
  let impersonateOceanHolder = await ethers.getSigner(this.oceanHolder);
  this.oceanContract = new ethers.Contract(
    this.oceanAddress,
    ERC20ABI,
    impersonateOceanHolder
  );
  tx = await this.oceanContract
    .connect(impersonateOceanHolder)
    .transfer(this.tokenSwap.address, 1000000n);
  await tx.wait();
}

// helper function to check the node balance
async function checkETHBalance(
  address: any,
  expectedBalance: bigint
): Promise<void> {
  let balance = await ethers.provider.getBalance(address);
  expect(balance).to.equal(expectedBalance);
}

// helper function to check the ERC20 balance
async function checkERC20Balance(
  contract: any,
  address: any,
  expectedBalance: bigint
): Promise<void> {
  let balance = await contract.balanceOf(address);
  expect(balance).to.equal(expectedBalance);
}

const getLogs = async (address: string) => {
  let revShareABI = require(path.resolve(
    __dirname,
    "../../abi/contracts/TokenSwap/TokenSwap.sol/TokenSwap.json"
  ));
  let contractInterface = new ethers.utils.Interface(revShareABI);
  let events = await ethers.provider
    .getLogs({
      fromBlock: 0,
      toBlock: "latest",
      address: address,
    })
    .then((events) => {
      return events
        .map((e) => {
          return contractInterface.parseLog(e).args;
        })
        .filter((events) => {
          return events.amount;
        });
    });
  return events;
};
