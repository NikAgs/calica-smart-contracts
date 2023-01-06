import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

const ERC20ABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json")
  .abi;

describe("ExpenseSubmission", function() {
  // Initialize global test variables
  before(async function() {
    this.ExpenseSubmission = await ethers.getContractFactory(
      "ExpenseSubmission"
    );

    let signers = await ethers.getSigners();
    this.owner = signers[0];
    this.adam = signers[1];
    this.nik = signers[2];
    this.moneySender = signers[3];
    this.profitAddress = signers[4].address;
    this.otherProfitAddress = signers[5].address;

    this.oceanHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.oceanAddress = "0x967da4048cD07aB37855c090aAF366e4ce1b9F48";
    this.usdcHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  });

  // Create a brand new ExpenseSubmission contract before each test
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

    this.expenseSubmission = await this.ExpenseSubmission.deploy();
    await this.expenseSubmission.deployed();
  });

  it("fails when reimbursing expenses before being initialized", async function() {
    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: ethers.utils.parseEther("3"),
    });

    try {
      await this.expenseSubmission.connect(this.owner).reimburseExpenses([0]);
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Profit address not set");
    }
  });

  it("fails when trying to reconfigure before being initialized", async function() {
    try {
      await this.expenseSubmission.connect(this.owner).reconfigure(
        [
          {
            name: "Adam",
            account: this.adam.address,
            cost: 100000n,
            amountPaid: 0n,
            tokenAddress: ethers.constants.AddressZero,
            description: "Adam's expenses",
          },
        ],
        this.profitAddress
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Profit address not set");
    }
  });

  it("fails to reconfigure when non-owner calls it", async function() {
    try {
      await initializeEthExpenses.bind(this)();

      await this.expenseSubmission.connect(this.adam).reconfigure(
        [
          {
            name: "Adam",
            account: this.adam.address,
            cost: 100000n,
            amountPaid: 0n,
            tokenAddress: ethers.constants.AddressZero,
            description: "Adam's expenses",
          },
        ],
        this.profitAddress
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Only owner can reconfigure");
    }
  });

  it("can initialize with no expenses", async function() {
    await this.expenseSubmission.initialize(
      {
        contractName: "Failed Initialize",
        expenses: [],
        profitAddress: this.profitAddress,
      },
      this.owner.address
    );
  });

  it("sets contract name correctly", async function() {
    await initializeEthExpenses.bind(this)();

    let contractName = await this.expenseSubmission.contractName();
    expect(contractName).to.equal("Valid Expense Submission");
  });

  it("sets owner correctly", async function() {
    await initializeEthExpenses.bind(this)();

    let owner = await this.expenseSubmission.owner();
    expect(owner).to.equal(this.owner.address);
  });

  it("sets expenses correctly", async function() {
    await initializeEthExpenses.bind(this)();

    let expenses = await this.expenseSubmission.getExpenses();
    let firstExpense = await expenses[0];
    let secondExpense = expenses[1];

    expect(firstExpense.name).to.equal("Adam");
    expect(firstExpense.account).to.equal(this.adam.address);
    expect(firstExpense.cost).to.equal(100000n);
    expect(firstExpense.amountPaid).to.equal(0n);
    expect(firstExpense.tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(secondExpense.name).to.equal("Nik");
    expect(secondExpense.account).to.equal(this.nik.address);
    expect(secondExpense.cost).to.equal(200000n);
    expect(secondExpense.amountPaid).to.equal(0n);
    expect(secondExpense.tokenAddress).to.equal(ethers.constants.AddressZero);
  });

  it("sets profitAddress correctly", async function() {
    await initializeEthExpenses.bind(this)();

    let profitAddress = await this.expenseSubmission.profitAddress();
    expect(profitAddress).to.equal(this.profitAddress);
  });

  it("can reconfigure expenses + profitAddress correctly", async function() {
    await initializeEthExpenses.bind(this, true)();

    let initialExpenses = await this.expenseSubmission.getExpenses();
    let initialProfitAddress = await this.expenseSubmission.profitAddress();

    await this.expenseSubmission.connect(this.owner).reconfigure(
      [
        {
          name: "New Adam",
          account: this.adam.address,
          cost: 500000n,
          amountPaid: 0n,
          tokenAddress: ethers.constants.AddressZero,
          description: "Adam's expenses",
        },
      ],
      this.otherProfitAddress
    );

    let reconfiguredExpenses = await this.expenseSubmission.getExpenses();
    let reconfiguredProfitAddress = await this.expenseSubmission.profitAddress();

    expect(initialExpenses.length).to.equal(2);
    expect(reconfiguredExpenses.length).to.equal(1);

    expect(reconfiguredExpenses[0].name).to.equal("New Adam");
    expect(reconfiguredExpenses[0].account).to.equal(this.adam.address);
    expect(reconfiguredExpenses[0].cost).to.equal(500000n);
    expect(reconfiguredExpenses[0].amountPaid).to.equal(0n);
    expect(reconfiguredExpenses[0].tokenAddress).to.equal(
      ethers.constants.AddressZero
    );
    expect(reconfiguredExpenses[0].description).to.equal("Adam's expenses");

    expect(initialProfitAddress).to.equal(this.profitAddress);
    expect(reconfiguredProfitAddress).to.equal(this.otherProfitAddress);
  });

  it("reimburses ETH correctly", async function() {
    await initializeEthExpenses.bind(this)();

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 300000n,
    });

    await this.expenseSubmission.reimburseExpenses([0, 1]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000100000n);
    await checkETHBalance(this.nik.address, 10000000000000000200000n);
  });

  it("reimburses ERC20 tokens correctly", async function() {
    await initializeTokenExpenses.bind(this)();

    await checkTokenBalance(
      this.expenseSubmission.address,
      this.usdcAddress,
      0n
    );
    await checkTokenBalance(
      this.expenseSubmission.address,
      this.oceanAddress,
      0n
    );
    await checkTokenBalance(this.adam.address, this.usdcAddress, 0n);
    await checkTokenBalance(this.adam.address, this.oceanAddress, 0n);
    await checkTokenBalance(this.nik.address, this.usdcAddress, 0n);
    await checkTokenBalance(this.nik.address, this.oceanAddress, 0n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 300000n,
    });

    await sendInitialTokens.bind(this)();

    await checkTokenBalance(
      this.expenseSubmission.address,
      this.usdcAddress,
      1000000n
    );
    await checkTokenBalance(
      this.expenseSubmission.address,
      this.oceanAddress,
      1000000n
    );

    await this.expenseSubmission.reimburseExpenses([0, 1]);

    await checkTokenBalance(
      this.expenseSubmission.address,
      this.usdcAddress,
      0n
    );
    await checkTokenBalance(
      this.expenseSubmission.address,
      this.oceanAddress,
      0n
    );
    await checkTokenBalance(this.adam.address, this.usdcAddress, 0n);
    await checkTokenBalance(this.adam.address, this.oceanAddress, 1000000n);
    await checkTokenBalance(this.nik.address, this.usdcAddress, 1000000n);
    await checkTokenBalance(this.nik.address, this.oceanAddress, 0n);
  });

  it("pays ETH profit correctly", async function() {
    await initializeEthExpenses.bind(this)();

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);
    await checkETHBalance(this.profitAddress, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 500000n,
    });

    await this.expenseSubmission.sendToProfitAddress([
      ethers.constants.AddressZero,
    ]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);
    await checkETHBalance(this.profitAddress, 10000000000000000500000n);
  });

  it("pays ERC20 token profit correctly", async function() {
    await initializeTokenExpenses.bind(this)();

    await checkETHBalance(this.profitAddress, 10000000000000000000000n);
    await checkTokenBalance(this.profitAddress, this.usdcAddress, 0n);
    await checkTokenBalance(this.profitAddress, this.oceanAddress, 0n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 500000n,
    });

    await sendInitialTokens.bind(this)();

    await this.expenseSubmission.sendToProfitAddress([
      ethers.constants.AddressZero,
      this.usdcAddress,
      this.oceanAddress,
    ]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.profitAddress, 10000000000000000500000n);
    await checkTokenBalance(this.profitAddress, this.usdcAddress, 1000000n);
    await checkTokenBalance(this.profitAddress, this.oceanAddress, 1000000n);
  });

  it("pays partial costs", async function() {
    await initializeEthExpenses.bind(this)();

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000000000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);
    await checkETHBalance(this.profitAddress, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 50000n,
    });

    await this.expenseSubmission.reimburseExpenses([0, 1]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000050000n);
    await checkETHBalance(this.nik.address, 10000000000000000000000n);
    await checkETHBalance(this.profitAddress, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 100000n,
    });

    await this.expenseSubmission.reimburseExpenses([0, 1]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000100000n);
    await checkETHBalance(this.nik.address, 10000000000000000050000n);
    await checkETHBalance(this.profitAddress, 10000000000000000000000n);

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 200000n,
    });

    await this.expenseSubmission.reimburseExpenses([1]);

    await checkETHBalance(this.expenseSubmission.address, 50000n);
    await checkETHBalance(this.adam.address, 10000000000000000100000n);
    await checkETHBalance(this.nik.address, 10000000000000000200000n);
    await checkETHBalance(this.profitAddress, 10000000000000000000000n);

    await this.expenseSubmission.sendToProfitAddress([
      ethers.constants.AddressZero,
    ]);

    await checkETHBalance(this.expenseSubmission.address, 0n);
    await checkETHBalance(this.adam.address, 10000000000000000100000n);
    await checkETHBalance(this.nik.address, 10000000000000000200000n);
    await checkETHBalance(this.profitAddress, 10000000000000000050000n);
  });

  it("emits ETH withdraw events correctly", async function() {
    await initializeEthExpenses.bind(this)();

    await this.moneySender.sendTransaction({
      to: this.expenseSubmission.address,
      value: 400000n,
    });

    await this.expenseSubmission.reimburseExpenses([0, 1]);

    await this.expenseSubmission.sendToProfitAddress([
      ethers.constants.AddressZero,
    ]);

    let events = await getLogs(this.expenseSubmission.address);

    expect(events.length).to.equal(3);
    expect(events[0].amount).to.equal(100000n);
    expect(events[0].account).to.equal(this.adam.address);
    expect(events[0].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[1].amount).to.equal(200000n);
    expect(events[1].account).to.equal(this.nik.address);
    expect(events[1].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[2].amount).to.equal(100000n);
    expect(events[2].account).to.equal(this.profitAddress);
    expect(events[2].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[0].timestamp).to.equal(events[1].timestamp);
    expect(events[1].timestamp).to.not.equal(events[2].timestamp);
  });

  it("emits ERC20 withdraw events correctly", async function() {
    await initializeTokenExpenses.bind(this)();

    await sendInitialTokens.bind(this)();

    await this.expenseSubmission.reimburseExpenses([0]);

    await this.expenseSubmission.sendToProfitAddress([this.usdcAddress]);

    let events = await getLogs(this.expenseSubmission.address);

    expect(events.length).to.equal(2);
    expect(events[0].amount).to.equal(1000000n);
    expect(events[0].account).to.equal(this.adam.address);
    expect(events[0].tokenAddress).to.equal(this.oceanAddress);

    expect(events[1].amount).to.equal(1000000n);
    expect(events[1].account).to.equal(this.profitAddress);
    expect(events[1].tokenAddress).to.equal(this.usdcAddress);

    expect(events[0].timestamp).to.not.equal(events[1].timestamp);
  });

  // helper function to set up two ETH expenses
  async function initializeEthExpenses(this: Mocha.Context): Promise<void> {
    await this.expenseSubmission.connect(this.owner).initialize(
      {
        contractName: "Valid Expense Submission",
        expenses: [
          {
            name: "Adam",
            account: this.adam.address,
            cost: 100000n,
            amountPaid: 0n,
            tokenAddress: ethers.constants.AddressZero,
            description: "Adam's expense",
          },
          {
            name: "Nik",
            account: this.nik.address,
            cost: 200000n,
            amountPaid: 0n,
            tokenAddress: ethers.constants.AddressZero,
            description: "Nik's expense",
          },
        ],
        profitAddress: this.profitAddress,
      },
      this.owner.address
    );
  }

  // helper function to set up two ERC20 token expense
  async function initializeTokenExpenses(this: Mocha.Context): Promise<void> {
    await this.expenseSubmission.connect(this.owner).initialize(
      {
        contractName: "Valid Expense Submission",
        expenses: [
          {
            name: "Adam",
            account: this.adam.address,
            cost: 1000000n,
            amountPaid: 0n,
            tokenAddress: this.oceanAddress,
            description: "Adam's expense",
          },
          {
            name: "Nik",
            account: this.nik.address,
            cost: 2000000n,
            amountPaid: 0n,
            tokenAddress: this.usdcAddress,
            description: "Nik's expense",
          },
        ],
        profitAddress: this.profitAddress,
      },
      this.owner.address
    );
  }
});

// helper function to check the ETH balance of a given address
async function checkETHBalance(
  address: any,
  expectedBalance: bigint
): Promise<void> {
  let balance = await ethers.provider.getBalance(address);
  expect(balance).to.equal(expectedBalance);
}

// helper function to check the token balance of a given address
async function checkTokenBalance(
  address: any,
  tokenAddress: any,
  expectedBalance: bigint
): Promise<void> {
  let token = await ethers.getContractAt("IERC20", tokenAddress);
  let balance = await token.balanceOf(address);
  expect(balance).to.equal(expectedBalance);
}

// helper function to send initial OCEAN + USDC tokens to the expense contract
async function sendInitialTokens(this: Mocha.Context): Promise<void> {
  // Create the OCEAN Contract instance and send OCEAN to the contract
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
  let tx = await this.oceanContract
    .connect(impersonateOceanHolder)
    .transfer(this.expenseSubmission.address, 1000000n);

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
    .transfer(this.expenseSubmission.address, 1000000n);
  await tx.wait();
}

const getLogs = async (address: string) => {
  let revShareABI = require(path.resolve(
    __dirname,
    "../../abi/contracts/ExpenseSubmission/ExpenseSubmission.sol/ExpenseSubmission.json"
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
