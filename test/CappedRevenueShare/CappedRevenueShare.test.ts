import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

const ERC20ABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json")
  .abi;

describe("CappedRevenueShare", function() {
  // Initialize global test variables
  before(async function() {
    this.CappedRevenueShare = await ethers.getContractFactory(
      "CappedRevenueShare"
    );

    this.tokenHolder = "0xf977814e90da44bfa03b6295a0616a897441acec";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    this.oceanAddress = "0x967da4048cD07aB37855c090aAF366e4ce1b9F48";

    this.signers = await ethers.getSigners();
    this.moneySender = this.signers[0];
    this.firstAccount = this.signers[1];
    this.secondAccount = this.signers[2];
    this.thirdAccount = this.signers[3];
    this.owner = this.signers[4];
  });

  // Create a brand new CappedRevenueShare contract before each test
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

    this.cappedRevenueShare = await this.CappedRevenueShare.deploy();
    await this.cappedRevenueShare.deployed();
  });

  it("fails to initialize with an empty capped splits", async function() {
    try {
      await this.cappedRevenueShare.initialize(
        {
          contractName: "Failed Initialize",
          cappedSplits: [],
        },
        this.owner.address,
        ethers.constants.AddressZero,
        false,
        true
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("No capped splits given");
    }
  });

  it("fails to initialize with a non-zero first cap", async function() {
    try {
      await this.cappedRevenueShare.initialize(
        {
          contractName: "Failed Initialize",
          cappedSplits: getCappedSplits.call(this, ["10"], [[100000]]),
        },
        this.owner.address,
        ethers.constants.AddressZero,
        false,
        true
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("First cap must be 0");
    }
  });

  it("fails to initialize with a split not adding up to 100000", async function() {
    try {
      await this.cappedRevenueShare.initialize(
        {
          contractName: "Failed Initialize",
          cappedSplits: getCappedSplits.call(
            this,
            ["0", "100"],
            [[100000], [10000, 50000]]
          ),
        },
        this.owner.address,
        ethers.constants.AddressZero,
        false,
        true
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Percentages must equal 1e5");
    }
  });

  it("fails to initialize with unsorted caps", async function() {
    try {
      await this.cappedRevenueShare.initialize(
        {
          contractName: "Failed Initialize",
          cappedSplits: getCappedSplits.call(
            this,
            ["0", "100", "50"],
            [[100000], [50000, 50000], [33333, 33333, 33334]]
          ),
        },
        this.owner.address,
        ethers.constants.AddressZero,
        false,
        true
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Caps must be sorted and unique");
    }
  });

  it("fails when trying to reconfigure before being initialized", async function() {
    try {
      await this.cappedRevenueShare.reconfigureCappedSplits(
        getCappedSplits.call(
          this,
          ["0", "3", "10"],
          [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
        )
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure splits when flag is set to false", async function() {
    try {
      await this.cappedRevenueShare.initialize(
        {
          contractName: "Valid Initializer",
          cappedSplits: getCappedSplits.call(
            this,
            ["0", "3", "10"],
            [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
          ),
        },
        this.owner.address,
        ethers.constants.AddressZero,
        false,
        true
      );

      await this.cappedRevenueShare.reconfigureCappedSplits(
        getCappedSplits.call(
          this,
          ["0", "3", "10"],
          [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
        )
      );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Contract isnt reconfigurable");
    }
  });

  it("fails to reconfigure when non-owner calls it", async function() {
    try {
      await this.cappedRevenueShare.connect(this.owner).initialize(
        {
          contractName: "Valid Initializer",
          cappedSplits: getCappedSplits.call(
            this,
            ["0", "3", "10"],
            [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
          ),
        },
        this.owner.address,
        ethers.constants.AddressZero,
        true,
        true
      );

      await this.cappedRevenueShare
        .connect(this.firstAccount)
        .reconfigureCappedSplits(
          getCappedSplits.call(
            this,
            ["0", "3", "10"],
            [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
          )
        );
      expect(false).to.be.true;
    } catch (e) {
      expect(e.message).to.contain("Only owner can reconfigure");
    }
  });

  it("sets valid input correctly", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "3", "10"],
          [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    let contractName = await this.cappedRevenueShare.contractName();
    let tokenAddress = await this.cappedRevenueShare.tokenAddress();
    let isReconfigurable = await this.cappedRevenueShare.isReconfigurable();
    let isPush = await this.cappedRevenueShare.isPush();

    expect(contractName).to.equal("Valid Initializer");
    expect(tokenAddress).to.equal(ethers.constants.AddressZero);
    expect(isReconfigurable).to.equal(false);
    expect(isPush).to.equal(true);

    let cappedSplits = await this.cappedRevenueShare.getCappedSplits();

    let firstCappedSplit = cappedSplits[0];
    let secondCappedSplit = cappedSplits[1];
    let thirdCappedSplit = cappedSplits[2];

    expect(cappedSplits.length).to.equal(3);

    let firstCap = firstCappedSplit.cap;
    let secondCap = secondCappedSplit.cap;
    let thirdCap = thirdCappedSplit.cap;
    expect(firstCap).to.equal(0n);
    expect(secondCap).to.equal(ethers.utils.parseEther("3"));
    expect(thirdCap).to.equal(ethers.utils.parseEther("10"));

    let firstSplits = firstCappedSplit.splits;
    expect(firstSplits[0].name).to.equal("Account 0");
    expect(firstSplits[0].account).to.equal(this.firstAccount.address);
    expect(firstSplits[0].percentage).to.equal(100000);
    expect(firstSplits.length).to.equal(1);

    let secondSplits = secondCappedSplit.splits;
    expect(secondSplits[0].name).to.equal("Account 0");
    expect(secondSplits[0].account).to.equal(this.firstAccount.address);
    expect(secondSplits[0].percentage).to.equal(5000);
    expect(secondSplits[1].name).to.equal("Account 1");
    expect(secondSplits[1].account).to.equal(this.secondAccount.address);
    expect(secondSplits[1].percentage).to.equal(5000);
    expect(secondSplits[2].name).to.equal("Account 2");
    expect(secondSplits[2].account).to.equal(this.thirdAccount.address);
    expect(secondSplits[2].percentage).to.equal(90000);
    expect(secondSplits.length).to.equal(3);

    let thirdSplits = thirdCappedSplit.splits;
    expect(thirdSplits[0].name).to.equal("Account 0");
    expect(thirdSplits[0].account).to.equal(this.firstAccount.address);
    expect(thirdSplits[0].percentage).to.equal(34000);
    expect(thirdSplits[1].name).to.equal("Account 1");
    expect(thirdSplits[1].account).to.equal(this.secondAccount.address);
    expect(thirdSplits[1].percentage).to.equal(33000);
    expect(thirdSplits[2].name).to.equal("Account 2");
    expect(thirdSplits[2].account).to.equal(this.thirdAccount.address);
    expect(thirdSplits[2].percentage).to.equal(33000);
    expect(thirdSplits.length).to.equal(3);
  });

  it("can reconfigure capped splits correctly", async function() {
    await this.cappedRevenueShare.connect(this.owner).initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "3", "10"],
          [[100000], [5000, 5000, 90000], [34000, 33000, 33000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      true,
      true
    );

    let initialCappedSplits = await this.cappedRevenueShare.getCappedSplits();

    await this.cappedRevenueShare
      .connect(this.owner)
      .reconfigureCappedSplits(getCappedSplits.call(this, ["0"], [[100000]]));

    let reconfiguredCappedSplits = await this.cappedRevenueShare.getCappedSplits();

    expect(initialCappedSplits.length).to.equal(3);
    expect(reconfiguredCappedSplits.length).to.equal(1);

    expect(reconfiguredCappedSplits[0].cap).to.equal(0n);
    expect(reconfiguredCappedSplits[0].splits.length).to.equal(1);
    expect(reconfiguredCappedSplits[0].splits[0].name).to.equal("Account 0");
    expect(reconfiguredCappedSplits[0].splits[0].account).to.equal(
      this.firstAccount.address
    );
    expect(reconfiguredCappedSplits[0].splits[0].percentage).to.equal(100000);
  });

  it("sets contract name correctly", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(this, ["0"], [[100000]]),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    let contractName = await this.cappedRevenueShare.contractName();
    expect(contractName).to.equal("Valid Initializer");
  });

  it("sets owner correctly", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(this, ["0"], [[100000]]),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    let owner = await this.cappedRevenueShare.owner();
    expect(owner).to.equal(this.owner.address);
  });

  it("pays out fractional ETH splits", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0"],
          [[33333, 33333, 33334]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

    await sendETH.call(this, "5");

    await checkBalance(this.cappedRevenueShare.address, 0n);
    await checkBalance(this.signers[1].address, 10001666650000000000000n);
    await checkBalance(this.signers[2].address, 10001666650000000000000n);
    await checkBalance(this.signers[3].address, 10001666700000000000000n);
  });

  it("pays out an ETH split before the first cap", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "100"],
          [[100000], [80000, 20000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await checkBalances.call(this, ["0", "10000", "10000"]);

    await sendETH.call(this, "5");

    await checkBalances.call(this, ["0", "10005", "10000"]);
  });

  it("pays out an ETH split in between caps", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "10", "20"],
          [[100000], [80000, 20000], [50000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await sendETH.call(this, "10");

    await checkBalances.call(this, ["0", "10010", "10000"]);

    await sendETH.call(this, "10");

    await checkBalances.call(this, ["0", "10018", "10002"]);
  });

  it("pays out an ETH split after the last cap", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "10", "20"],
          [[100000], [80000, 20000], [50000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await sendETH.call(this, "20");

    await checkBalances.call(this, ["0", "10018", "10002"]);

    await sendETH.call(this, "10");

    await checkBalances.call(this, ["0", "10023", "10007"]);
  });

  it("pays out multiple ETH splits before and after first cap", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "100", "200"],
          [[100000], [80000, 20000], [20000, 30000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

    await sendETH.call(this, "150");

    await checkBalances.call(this, ["0", "10140", "10010"]);
  });

  it("pays out multiple ETH splits before and after last cap", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "100", "200"],
          [[100000], [80000, 20000], [20000, 30000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await sendETH.call(this, "150");

    await checkBalances.call(this, ["0", "10140", "10010", "10000"]);

    await sendETH.call(this, "150");

    await checkBalances.call(this, ["0", "10200", "10050", "10050"]);
  });

  it("pays out multiple ETH splits before, after, and between two caps", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "100", "200"],
          [[100000], [80000, 20000], [20000, 30000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await checkBalances.call(this, ["0", "10000", "10000", "10000"]);

    await sendETH.call(this, "300");

    await checkBalances.call(this, ["0", "10200", "10050", "10050"]);
  });

  it("emits withdraw events correctly", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(
          this,
          ["0", "100", "200"],
          [[100000], [80000, 20000], [20000, 30000, 50000]]
        ),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      true
    );

    await sendETH.call(this, "300");

    let events = await getLogs(this.cappedRevenueShare.address);

    expect(events.length).to.equal(3);
    expect(events[0].amount).to.equal(200000000000000000000n);
    expect(events[0].account).to.equal(this.firstAccount.address);
    expect(events[0].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[1].amount).to.equal(50000000000000000000n);
    expect(events[1].account).to.equal(this.secondAccount.address);
    expect(events[1].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[2].amount).to.equal(50000000000000000000n);
    expect(events[2].account).to.equal(this.thirdAccount.address);
    expect(events[2].tokenAddress).to.equal(ethers.constants.AddressZero);

    expect(events[0].timestamp).to.equal(events[1].timestamp);
    expect(events[1].timestamp).to.equal(events[2].timestamp);
  });

  it("can withdraw ERC20 tokens", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(this, ["0"], [[80000, 20000]]),
      },
      this.owner.address,
      this.usdcAddress,
      false,
      true
    );

    await transferTokensToContract.bind(this)();

    await this.cappedRevenueShare
      .connect(this.owner)
      .withdrawTokens([this.usdcAddress]);

    await checkBalances.call(
      this,
      ["0", "800000", "200000"],
      this.usdcContract
    );

    await checkBalances.call(this, ["1000000", "0", "0"], this.oceanContract);
  });

  it("can withdraw non-tokenAddress tokens", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(this, ["0"], [[80000, 20000]]),
      },
      this.owner.address,
      this.usdcAddress,
      false,
      true
    );

    await transferTokensToContract.bind(this)();

    await this.cappedRevenueShare
      .connect(this.owner)
      .withdrawTokens([this.usdcAddress, this.oceanAddress]);

    await checkBalances.call(
      this,
      ["0", "800000", "200000"],
      this.usdcContract
    );

    await checkBalances.call(this, ["0"], this.oceanContract);
    let balance = await this.oceanContract.balanceOf(this.owner.address);
    expect(balance).to.equal(1000000n);
  });

  it("can withdraw ETH", async function() {
    await this.cappedRevenueShare.initialize(
      {
        contractName: "Valid Initializer",
        cappedSplits: getCappedSplits.call(this, ["0"], [[80000, 20000]]),
      },
      this.owner.address,
      ethers.constants.AddressZero,
      false,
      false
    );

    await sendETH.call(this, "100");

    await this.cappedRevenueShare
      .connect(this.owner)
      .withdrawTokens([ethers.constants.AddressZero]);

    await checkBalances.call(this, ["0", "10080", "10020"]);
  });

  // sends a given amount of eth to the capped revenue share contract address
  async function sendETH(this: Mocha.Context, eth: string) {
    await this.moneySender.sendTransaction({
      to: this.cappedRevenueShare.address,
      value: ethers.utils.parseEther(eth),
    });
  }

  // returns an array of capped splits with given caps and split percentages
  function getCappedSplits(
    this: Mocha.Context,
    caps: string[],
    splits: number[][]
  ): { cap: bigint; splits: { account: string; percentage: number }[] }[] {
    let cappedSplits = [];

    for (let i = 0; i < caps.length; i++) {
      cappedSplits.push({
        cap: ethers.utils.parseEther(caps[i]).toBigInt(),
        splits: getSplits.call(this, splits[i]),
      });
    }

    return cappedSplits;
  }

  // returns an array of splits with given percentages. Accounts are assigned in sequence starting from signers[1].
  function getSplits(
    this: Mocha.Context,
    percentages: number[]
  ): { account: string; percentage: number }[] {
    let splits = [];

    for (let i = 0; i < percentages.length; i++) {
      splits.push({
        name: "Account " + i,
        account: this.signers[i + 1].address,
        percentage: percentages[i],
      });
    }
    return splits;
  }

  // helper function to check balances for the capped revenue share contract + signer addresses
  async function checkBalances(
    this: Mocha.Context,
    expectedBalances: string[],
    contract: any = null
  ): Promise<void> {
    for (let i = 0; i < expectedBalances.length; i++) {
      let expectedBalance = contract
        ? expectedBalances[i]
        : ethers.utils.parseEther(expectedBalances[i]).toBigInt();
      if (i == 0)
        await checkBalance(
          this.cappedRevenueShare.address,
          expectedBalance,
          contract
        );
      else
        await checkBalance(this.signers[i].address, expectedBalance, contract);
    }
  }

  // helper function to check the node balance
  async function checkBalance(
    address: any,
    expectedBalance: bigint | string,
    contract: any = null
  ): Promise<void> {
    if (!contract) {
      let balance = await ethers.provider.getBalance(address);
      expect(balance).to.equal(expectedBalance);
    } else {
      let balance = await contract.balanceOf(address);
      expect(balance).to.equal(expectedBalance);
    }
  }

  // helper function to send some OCEAN and USDC to the revenue share contract
  async function transferTokensToContract(this: Mocha.Context) {
    // Create the USDC Contract instance and send USDC to the contract
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.tokenHolder],
    });
    let impersonateHolder = await ethers.getSigner(this.tokenHolder);
    this.usdcContract = new ethers.Contract(
      this.usdcAddress,
      ERC20ABI,
      impersonateHolder
    );
    let tx = await this.usdcContract
      .connect(impersonateHolder)
      .transfer(this.cappedRevenueShare.address, 1000000n);
    await tx.wait();

    // Create the Ocean Contract instance and send Ocean to the contract
    this.oceanContract = new ethers.Contract(
      this.oceanAddress,
      ERC20ABI,
      impersonateHolder
    );
    tx = await this.oceanContract
      .connect(impersonateHolder)
      .transfer(this.cappedRevenueShare.address, 1000000n);
    await tx.wait();
  }

  const getLogs = async (address: string) => {
    let cappedRevShareABI = require(path.resolve(
      __dirname,
      "../../abi/contracts/CappedRevenueShare/CappedRevenueShare.sol/CappedRevenueShare.json"
    ));
    let contractInterface = new ethers.utils.Interface(cappedRevShareABI);
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
});
