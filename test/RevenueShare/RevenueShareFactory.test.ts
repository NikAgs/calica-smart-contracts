import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("RevenueShareFactory", function() {
  // Initialize global test variables
  before(async function() {
    this.RevenueShareFactory = await ethers.getContractFactory(
      "RevenueShareFactory"
    );

    this.validInput = {
      contractName: "Valid Revenue Share",
      splits: [
        {
          name: "First",
          account: (await ethers.getSigners())[0].address,
          percentage: 100000,
        },
      ],
    };

    this.validSplitTuple = {
      contractName: "Valid Revenue Share 2",
      splits: [
        {
          name: "First",
          account: (await ethers.getSigners())[0].address,
          percentage: 50000,
        },
        {
          name: "Second",
          account: (await ethers.getSigners())[1].address,
          percentage: 50000,
        },
      ],
    };
  });

  // Create a brand new RevenueShare contract before each test
  beforeEach(async function() {
    await network.provider.send("hardhat_reset");
    this.revenueShareFactory = await this.RevenueShareFactory.deploy();
    await this.revenueShareFactory.deployed();
  });

  it("won't create a RevenueShare contract without being initialized", async function() {
    try {
      await this.revenueShareFactory.createNewRevenueShare(
        this.validInput,
        false,
        true
      );
    } catch (e) {
      expect(e.message).to.contain("Must be initialized first");
    }
  });

  it("can create a RevenueShare contract and initialize it", async function() {
    await this.revenueShareFactory.initialize();

    let deployedAddress = await this.revenueShareFactory.createNewRevenueShare(
      this.validInput,
      false,
      true
    );
    await deployedAddress.wait();

    let events = await getLogs(this.revenueShareFactory.address);
    let revShareABI = require(path.resolve(
      __dirname,
      "../../abi/contracts/RevenueShare/RevenueShare.sol/RevenueShare.json"
    ));
    let deployedClone = new ethers.Contract(
      events[0].cloneAddress,
      revShareABI,
      ethers.provider.getSigner()
    );
    let deployedName = await deployedClone.contractName();

    expect(deployedName).to.equal("Valid Revenue Share");
  });

  it("can create a RevenueShare contract and reconfigure it", async function() {
    await this.revenueShareFactory.initialize();

    let deployedAddress = await this.revenueShareFactory.createNewRevenueShare(
      this.validInput,
      true,
      true
    );
    await deployedAddress.wait();

    let events = await getLogs(this.revenueShareFactory.address);
    let revShareABI = require(path.resolve(
      __dirname,
      "../../abi/contracts/RevenueShare/RevenueShare.sol/RevenueShare.json"
    ));
    let deployedClone = new ethers.Contract(
      events[0].cloneAddress,
      revShareABI,
      ethers.provider.getSigner()
    );

    let initialSplits = await deployedClone.getSplits();

    await deployedClone.reconfigureSplits(this.validSplitTuple.splits);

    let reconfiguredSplits = await deployedClone.getSplits();

    expect(initialSplits.length).to.equal(1);
    expect(reconfiguredSplits.length).to.equal(2);
  });

  it("can emit a correct event", async function() {
    await this.revenueShareFactory.initialize();

    let deployedAddress = await this.revenueShareFactory.createNewRevenueShare(
      this.validInput,
      false,
      true
    );
    await deployedAddress.wait();

    let events = await getLogs(this.revenueShareFactory.address);
    let firstAccount = (await ethers.getSigners())[0].address;

    expect(events.length).to.equal(1);

    expect(events[0].cloneAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
    expect(events[0].splitAddress).to.equal(firstAccount);
    expect(events[0].contractName).to.equal("Valid Revenue Share");
  });

  it("emits multiple events", async function() {
    await this.revenueShareFactory.initialize();

    let deployedAddress = await this.revenueShareFactory.createNewRevenueShare(
      this.validSplitTuple,
      false,
      true
    );
    await deployedAddress.wait();

    let events = await getLogs(this.revenueShareFactory.address);
    let firstAccount = (await ethers.getSigners())[0].address;
    let secondAccount = (await ethers.getSigners())[1].address;

    expect(events.length).to.equal(2);

    expect(events[0].cloneAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
    expect(events[0].splitAddress).to.equal(firstAccount);
    expect(events[0].contractName).to.equal("Valid Revenue Share 2");

    expect(events[1].cloneAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(events[1].cloneAddress)).to.be.true;
    expect(events[1].splitAddress).to.equal(secondAccount);
    expect(events[1].contractName).to.equal("Valid Revenue Share 2");
  });

  it("can update the implementation address", async function() {
    await this.revenueShareFactory.initialize();

    let firstImplAddress = await this.revenueShareFactory.implementationAddress();
    expect(firstImplAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(firstImplAddress)).to.be.true;

    await this.revenueShareFactory.updateImplementation();

    let secondImplAddress = await this.revenueShareFactory.implementationAddress();
    expect(secondImplAddress).to.not.equal(firstImplAddress);
    expect(ethers.utils.isAddress(secondImplAddress)).to.be.true;
  });
});

const getLogs = async (address: string) => {
  let revShareFactoryABI = require(path.resolve(
    __dirname,
    "../../abi/contracts/RevenueShare/RevenueShareFactory.sol/RevenueShareFactory.json"
  ));
  let contractInterface = new ethers.utils.Interface(revShareFactoryABI);
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
          return events.cloneAddress;
        });
    });
  return events;
};
