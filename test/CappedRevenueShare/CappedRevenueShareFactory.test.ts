import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("CappedRevenueShareFactory", function () {
    // Initialize global test variables
    before(async function () {
        this.CappedRevenueShareFactory = await ethers.getContractFactory(
            "CappedRevenueShareFactory"
        );

        this.validInput = {
            contractName: "Valid Capped Revenue Share",
            cappedSplits: [{
                cap: 0n,
                splits: [{
                    name: "First",
                    account: (await ethers.getSigners())[0].address,
                    percentage: 100000,
                }],
            }],
        }

        this.validSplitTuple = {
            contractName: "Valid Capped Revenue Share 2",
            cappedSplits: [{
                cap: 0n,
                splits: [{
                    name: "First",
                    account: (await ethers.getSigners())[0].address,
                    percentage: 80000,
                },
                {
                    name: "Second",
                    account: (await ethers.getSigners())[1].address,
                    percentage: 20000,
                }],
            },
            {
                cap: 100n,
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
                    }
                ]
            }]
        }
    });

    // Create a brand new CappedRevenueShare contract before each test
    beforeEach(async function () {
        await network.provider.send("hardhat_reset");
        this.cappedRevenueShareFactory = await this.CappedRevenueShareFactory.deploy();
        await this.cappedRevenueShareFactory.deployed();
    });

    it("won't create a CappedRevenueShare contract without being initialized", async function () {
        try {
            await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validInput, false);
        } catch (e: any) {
            expect(e.message).to.contain("Must be initialized first");
        }
    });

    it("can create a CappedRevenueShare contract and initialize it", async function () {
        await this.cappedRevenueShareFactory.initialize();

        let deployedAddress = await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validInput, false);
        await deployedAddress.wait();

        let events = await getLogs(this.cappedRevenueShareFactory.address);
        let cappedRevShareABI = require(path.resolve(__dirname, "../../abi/contracts/CappedRevenueShare/CappedRevenueShare.sol/CappedRevenueShare.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, cappedRevShareABI, ethers.provider.getSigner());
        let deployedName = await deployedClone.contractName();

        expect(deployedName).to.equal("Valid Capped Revenue Share");
    });

    it("can create a CappedRevenueShare contract and reconfigure it", async function () {
        await this.cappedRevenueShareFactory.initialize();

        let deployedAddress = await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validInput, true);
        await deployedAddress.wait();

        let events = await getLogs(this.cappedRevenueShareFactory.address);
        let cappedRevShareABI = require(path.resolve(__dirname, "../../abi/contracts/CappedRevenueShare/CappedRevenueShare.sol/CappedRevenueShare.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, cappedRevShareABI, ethers.provider.getSigner());

        let initialSplits = await deployedClone.getCappedSplits();

        await deployedClone.reconfigureCappedSplits(this.validSplitTuple.cappedSplits);

        let reconfiguredSplits = await deployedClone.getCappedSplits();

        expect(initialSplits.length).to.equal(1);
        expect(reconfiguredSplits.length).to.equal(2);
    });

    it("emits multiple events", async function () {
        await this.cappedRevenueShareFactory.initialize();

        let deployedAddress = await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validSplitTuple, false);
        await deployedAddress.wait();

        let events = await getLogs(this.cappedRevenueShareFactory.address);
        let firstAccount = (await ethers.getSigners())[0].address;
        let secondAccount = (await ethers.getSigners())[1].address;

        expect(events.length).to.equal(2);

        expect(events[0].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
        expect(events[0].splitAddress).to.equal(firstAccount);
        expect(events[0].contractName).to.equal("Valid Capped Revenue Share 2");

        expect(events[1].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[1].cloneAddress)).to.be.true;
        expect(events[1].splitAddress).to.equal(secondAccount);
        expect(events[1].contractName).to.equal("Valid Capped Revenue Share 2");
    });

    it("can update the implementation address", async function () {
        await this.cappedRevenueShareFactory.initialize();

        let firstImplAddress = await this.cappedRevenueShareFactory.implementationAddress();
        expect(firstImplAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(firstImplAddress)).to.be.true;

        await this.cappedRevenueShareFactory.updateImplementation();

        let secondImplAddress = await this.cappedRevenueShareFactory.implementationAddress();
        expect(secondImplAddress).to.not.equal(firstImplAddress);
        expect(ethers.utils.isAddress(secondImplAddress)).to.be.true;

    });
});

const getLogs = async (address: string) => {
    let cappedRevShareFactoryABI = require(path.resolve(__dirname, "../../abi/contracts/CappedRevenueShare/CappedRevenueShareFactory.sol/CappedRevenueShareFactory.json"))
    let contractInterface = new ethers.utils.Interface(cappedRevShareFactoryABI)
    let events = await ethers.provider.getLogs({
        fromBlock: 0,
        toBlock: 'latest',
        address: address,
    }).then((events) => {
        return events.map((e) => {
            return contractInterface.parseLog(e).args
        }).filter((events) => {
            return events.cloneAddress;
        });
    })
    return events;
}