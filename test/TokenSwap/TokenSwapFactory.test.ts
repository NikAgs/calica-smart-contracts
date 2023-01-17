import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("TokenSwapFactory", function() {
  // Initialize global test variables
  before(async function() {
    this.TokenSwapFactory = await ethers.getContractFactory("TokenSwapFactory");

    this.daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    this.wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    this.usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    this.signers = await ethers.getSigners();

    this.validInput = {
      contractName: "Valid Token Swap",
      tokenIn: this.wethAddress,
      tokenOut: this.usdcAddress,
      profitAddress: this.signers[1].address,
      poolFee: 500,
      slippage: 0,
      wethAddress: this.wethAddress,
    };
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
      expect(false).to.be.true;
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

  it("can create a TokenSwap contract and reconfigure it", async function() {
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
    let initialTokenIn = await deployedClone.tokenIn();
    let initialTokenOut = await deployedClone.tokenOut();
    let initialPoolFee = await deployedClone.poolFee();

    await deployedClone.reconfigure(
      this.signers[2].address,
      this.usdcAddress,
      this.daiAddress,
      500
    );

    let updatedProfitAddress = await deployedClone.profitAddress();
    let updatedTokenIn = await deployedClone.tokenIn();
    let updatedTokenOut = await deployedClone.tokenOut();
    let updatedPoolFee = await deployedClone.poolFee();

    expect(initialProfitAddress).to.equal(this.signers[1].address);
    expect(updatedProfitAddress).to.equal(this.signers[2].address);

    expect(initialTokenIn).to.equal(this.wethAddress);
    expect(updatedTokenIn).to.equal(this.usdcAddress);

    expect(initialTokenOut).to.equal(this.usdcAddress);
    expect(updatedTokenOut).to.equal(this.daiAddress);

    expect(initialPoolFee).to.equal(500);
    expect(updatedPoolFee).to.equal(500);
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
