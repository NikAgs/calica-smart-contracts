import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

const ERC20ABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json")
  .abi;

describe("RevenueShare", function() {
  // Initialize global test variables
  before(async function() {
    this.RevenueShare = await ethers.getContractFactory("RevenueShare");

    this.usdcHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    this.oceanHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.oceanAddress = "0x967da4048cD07aB37855c090aAF366e4ce1b9F48";

    let signers = await ethers.getSigners();
    this.moneySender = signers[0];
    this.adam = signers[1];
    this.nik = signers[2];
    this.owner = signers[3];
  });

  // Create a brand new RevenueShare contract before each test
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

    this.revenueShare = await this.RevenueShare.deploy();
    await this.revenueShare.deployed();
  });

  it("fails to initialize with an empty split", async function() {
    try {
      await this.revenueShare.initialize(
        {
          contractName: "Failed Initialize",
          splits: [],
        },
        this.owner.address,
        false,
        true
      );

      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("No splits configured");
    }
  });

  it("fails when percentages don't add up to 100000", async function() {
    try {
      await this.revenueShare.initialize(
        {
          contractName: "Failed Initialize",
          splits: [
            {
              name: "Adam",
              account: this.adam.address,
              percentage: 80000,
            },
            {
              name: "Nik",
              account: this.nik.address,
              percentage: 90000,
            },
          ],
        },
        this.owner.address,
        false,
        true
      );

      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Percentages must equal 1e5");
    }
  });

  it("fails when trying to reconfigure before being initialized", async function() {
    try {
      await this.revenueShare.reconfigureSplits([
        {
          name: "Adam",
          account: this.adam.address,
          percentage: 100000,
        },
      ]);
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure splits when flag is set to false", async function() {
    try {
      await initializeValidRevenueShare.bind(this)();

      await this.revenueShare.reconfigureSplits([
        {
          name: "Adam",
          account: this.adam.address,
          percentage: 100000,
        },
      ]);
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure when non-owner calls it", async function() {
    await initializeValidRevenueShare.bind(this, true)();

    try {
      await this.revenueShare.connect(this.adam).reconfigureSplits([
        {
          name: "Adam",
          account: this.adam.address,
          percentage: 100000,
        },
      ]);
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Only owner can reconfigure");
    }
  });

  it("sets contract name correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    let contractName = await this.revenueShare.contractName();
    expect(contractName).to.equal("Valid Revenue Share");
  });

  it("sets owner correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    let owner = await this.revenueShare.owner();
    expect(owner).to.equal(this.owner.address);
  });

  it("sets splits correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    let splits = await this.revenueShare.getSplits();
    let firstSplit = await splits[0];
    let secondSplit = splits[1];

    expect(firstSplit.account).to.equal(this.adam.address);
    expect(firstSplit.percentage).to.equal(50000);

    expect(secondSplit.account).to.equal(this.nik.address);
    expect(secondSplit.percentage).to.equal(50000);
  });

  it("sets reconfigurable correctly", async function() {
    await initializeValidRevenueShare.bind(this)(true, true);

    let reconfigurable = await this.revenueShare.isReconfigurable();
    expect(reconfigurable).to.equal(true);
  });

  it("can reconfigure splits correctly", async function() {
    await initializeValidRevenueShare.bind(this, true)();

    let initialSplits = await this.revenueShare.getSplits();

    await this.revenueShare.connect(this.owner).reconfigureSplits([
      {
        name: "Adam",
        account: this.adam.address,
        percentage: 100000,
      },
    ]);

    let reconfiguredSplits = await this.revenueShare.getSplits();

    expect(initialSplits.length).to.equal(2);

    expect(reconfiguredSplits.length).to.equal(1);
    expect(reconfiguredSplits[0].name).to.equal("Adam");
    expect(reconfiguredSplits[0].account).to.equal(this.adam.address);
    expect(reconfiguredSplits[0].percentage).to.equal(100000);
  });

  it("gets splits correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    let splits = await this.revenueShare.getSplits();

    expect(splits[0].name).to.equal("Adam");
    expect(splits[0].account).to.equal(this.adam.address);
    expect(splits[0].percentage).to.equal(50000);

    expect(splits[1].name).to.equal("Nik");
    expect(splits[1].account).to.equal(this.nik.address);
    expect(splits[1].percentage).to.equal(50000);
  });

  it("holds ETH when not a push contract", async function() {
    await initializeValidRevenueShare.bind(this)(false, false);

    await checkETHBalance(this.revenueShare.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.revenueShare.address,
      value: ethers.utils.parseEther("3"),
    });

    await checkETHBalance(this.revenueShare.address, 3000000000000000000n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);
  });

  it("withdraws ETH correctly", async function() {
    await initializeValidRevenueShare.bind(this)(false, false);

    await this.moneySender.sendTransaction({
      to: this.revenueShare.address,
      value: ethers.utils.parseEther("3"),
    });

    await this.revenueShare
      .connect(this.owner)
      .withdrawTokens([ethers.constants.AddressZero]);

    await checkETHBalance(this.revenueShare.address, 0n);
    await checkETHBalance(this.adam.address, 10001500000000000000000n);
    await checkETHBalance(this.nik.address, 10001500000000000000000n);
  });

  it("withdraw tokens correctly", async function() {
    await initializeValidRevenueShare.bind(this)(false, true);
    await transferTokensToContract.bind(this)();

    await this.revenueShare
      .connect(this.owner)
      .withdrawTokens([this.usdcAddress, this.oceanAddress]);

    await checkERC20Balance(this.usdcContract, this.adam.address, 500000n);
    await checkERC20Balance(this.usdcContract, this.nik.address, 500000n);
    await checkERC20Balance(this.usdcContract, this.revenueShare.address, 0n);
    await checkERC20Balance(this.oceanContract, this.adam.address, 500000n);
    await checkERC20Balance(this.oceanContract, this.nik.address, 500000n);
    await checkERC20Balance(this.oceanContract, this.revenueShare.address, 0n);
  });

  it("distributes ETH correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    await checkETHBalance(this.revenueShare.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.revenueShare.address,
      value: ethers.utils.parseEther("3"),
    });

    await checkETHBalance(this.revenueShare.address, 0n);
    await checkETHBalance(this.adam.address, 10001500000000000000000n);
    await checkETHBalance(this.nik.address, 10001500000000000000000n);
  });

  it("emits ETH withdraw events correctly", async function() {
    await initializeValidRevenueShare.bind(this)();

    await this.moneySender.sendTransaction({
      to: this.revenueShare.address,
      value: ethers.utils.parseEther("10"),
    });

    let events = await getLogs(this.revenueShare.address);

    expect(events.length).to.equal(2);
    expect(events[0].amount).to.equal(5000000000000000000n);
    expect(events[0].account).to.equal(this.adam.address);

    expect(events[1].amount).to.equal(5000000000000000000n);
    expect(events[1].account).to.equal(this.nik.address);

    expect(events[0].timestamp).to.equal(events[1].timestamp);
  });

  it("emits token withdraw events correctly", async function() {
    await initializeValidRevenueShare.bind(this)(false, true);
    await transferTokensToContract.bind(this)();

    await this.revenueShare
      .connect(this.owner)
      .withdrawTokens([this.usdcAddress, this.oceanAddress]);

    let events = await getLogs(this.revenueShare.address);

    expect(events.length).to.equal(4);

    expect(events[0].amount).to.equal(500000n);
    expect(events[0].account).to.equal(this.adam.address);
    expect(events[0].tokenAddress).to.equal(this.usdcAddress);

    expect(events[1].amount).to.equal(500000n);
    expect(events[1].account).to.equal(this.nik.address);
    expect(events[1].tokenAddress).to.equal(this.usdcAddress);

    expect(events[2].amount).to.equal(500000n);
    expect(events[2].account).to.equal(this.adam.address);
    expect(events[2].tokenAddress).to.equal(this.oceanAddress);

    expect(events[3].amount).to.equal(500000n);
    expect(events[3].account).to.equal(this.nik.address);
    expect(events[3].tokenAddress).to.equal(this.oceanAddress);

    expect(events[0].timestamp).to.equal(events[1].timestamp);
    expect(events[1].timestamp).to.equal(events[2].timestamp);
    expect(events[2].timestamp).to.equal(events[3].timestamp);
  });

  // helper function to set up a 50/50 split
  async function initializeValidRevenueShare(
    this: Mocha.Context,
    reconfigurable: boolean = false,
    isPush: boolean = true
  ): Promise<void> {
    await this.revenueShare.connect(this.owner).initialize(
      {
        contractName: "Valid Revenue Share",
        splits: [
          {
            name: "Adam",
            account: this.adam.address,
            percentage: 50000,
          },
          {
            name: "Nik",
            account: this.nik.address,
            percentage: 50000,
          },
        ],
      },
      this.owner.address,
      reconfigurable,
      isPush
    );
  }
});

// helper function to send some OCEAN and USDC to the revenue share contract
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
    .transfer(this.revenueShare.address, 1000000n);
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
    .transfer(this.revenueShare.address, 1000000n);
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
    "../../abi/contracts/RevenueShare/RevenueShare.sol/RevenueShare.json"
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
