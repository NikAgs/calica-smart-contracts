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
            name: "Valid Capped Revenue Share",
            cappedSplits: [{
                cap: 0n,
                splits: [{
                    account: (await ethers.getSigners())[0].address,
                    percentage: 100000,
                }],
            }],
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
            await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validInput);
        } catch (e: any) {
            expect(e.message).to.contain("Must be initialized first");
        }
    });

    it("can create a CappedRevenueShare contract and initialize it", async function () {
        await this.cappedRevenueShareFactory.initialize();

        let deployedAddress = await this.cappedRevenueShareFactory.createNewCappedRevenueShare(this.validInput);
        await deployedAddress.wait();

        let events = await getLogs(this.cappedRevenueShareFactory.address);
        let cappedRevShareABI = require(path.resolve(__dirname, "../../abi/contracts/CappedRevenueShare/CappedRevenueShare.sol/CappedRevenueShare.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, cappedRevShareABI, ethers.provider.getSigner());
        let deployedName = await deployedClone.name();

        expect(deployedName).to.equal("Valid Capped Revenue Share");
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