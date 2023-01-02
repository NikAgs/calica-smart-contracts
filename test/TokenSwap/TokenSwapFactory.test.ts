import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe.only("TokenSwapFactory", function() {
  // Initialize global test variables
  before(async function() {
    this.TokenSwapFactory = await ethers.getContractFactory("TokenSwapFactory");

    this.signers = await ethers.getSigners();

    this.validInput = {
      contractName: "Valid Token Swap",
      tokenIn: "0x0000000000000000000000000000000000000000",
      tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      poolAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      profitAddress: this.signers[1].address,
      poolFee: 500,
    };
  });

  // Create a brand new TokenSwap contract before each test
  beforeEach(async function() {
    await network.provider.send("hardhat_reset");
    this.tokenSwapFactory = await this.TokenSwapFactory.deploy();
    await this.tokenSwapFactory.deployed();
  });

  it("won't create a TokenSwap contract without being initialized", async function() {
    try {
      await this.tokenSwapFactory.createNewTokenSwap(
        this.validInput,
        false,
        true,
        0
      );
    } catch (e) {
      expect(e.message).to.contain("Must be initialized first");
    }
  });

  it("can create a TokenSwap contract and initialize it", async function() {
    await this.tokenSwapFactory.initialize();

    let deployedAddress = await this.tokenSwapFactory.createNewTokenSwap(
      this.validInput,
      false,
      true,
      0
    );
    await deployedAddress.wait();

    let events = await getLogs(this.tokenSwapFactory.address);
    let revShareABI = require(path.resolve(
      __dirname,
      "../../abi/contracts/TokenSwap/TokenSwap.sol/TokenSwap.json"
    ));
    let deployedClone = new ethers.Contract(
      events[0].cloneAddress,
      revShareABI,
      ethers.provider.getSigner()
    );
    let deployedName = await deployedClone.contractName();

    expect(deployedName).to.equal("Valid Token Swap");
  });

  it("can create a TokenSwap contract and change profit address", async function() {
    await this.tokenSwapFactory.initialize();

    let deployedAddress = await this.tokenSwapFactory.createNewTokenSwap(
      this.validInput,
      true,
      true,
      0
    );
    await deployedAddress.wait();

    let events = await getLogs(this.tokenSwapFactory.address);
    let revShareABI = require(path.resolve(
      __dirname,
      "../../abi/contracts/TokenSwap/TokenSwap.sol/TokenSwap.json"
    ));
    let deployedClone = new ethers.Contract(
      events[0].cloneAddress,
      revShareABI,
      ethers.provider.getSigner()
    );

    let initialProfitAddress = await deployedClone.profitAddress();

    await deployedClone.reconfigureProfitAddress(this.signers[2].address);

    let updatedProfitAddress = await deployedClone.profitAddress();

    expect(initialProfitAddress).to.equal(this.signers[1].address);
    expect(updatedProfitAddress).to.equal(this.signers[2].address);
  });

  it("can emit a correct event", async function() {
    await this.tokenSwapFactory.initialize();

    let deployedAddress = await this.tokenSwapFactory.createNewTokenSwap(
      this.validInput,
      false,
      true,
      0
    );
    await deployedAddress.wait();

    let events = await getLogs(this.tokenSwapFactory.address);
    let firstAccount = (await ethers.getSigners())[0].address;

    expect(events.length).to.equal(1);

    expect(events[0].cloneAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
    expect(events[0].splitAddress).to.equal(firstAccount);
    expect(events[0].contractName).to.equal("Valid Token Swap");
  });

  it("can update the implementation address", async function() {
    await this.tokenSwapFactory.initialize();

    let firstImplAddress = await this.tokenSwapFactory.implementationAddress();
    expect(firstImplAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(ethers.utils.isAddress(firstImplAddress)).to.be.true;

    await this.tokenSwapFactory.updateImplementation();

    let secondImplAddress = await this.tokenSwapFactory.implementationAddress();
    expect(secondImplAddress).to.not.equal(firstImplAddress);
    expect(ethers.utils.isAddress(secondImplAddress)).to.be.true;
  });
});

const getLogs = async (address: string) => {
  let tokenSwapFactoryABI = require(path.resolve(
    __dirname,
    "../../abi/contracts/TokenSwap/TokenSwapFactory.sol/TokenSwapFactory.json"
  ));
  let contractInterface = new ethers.utils.Interface(tokenSwapFactoryABI);
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
