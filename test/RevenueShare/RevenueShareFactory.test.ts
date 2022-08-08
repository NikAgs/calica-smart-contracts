import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("RevenueShareFactory", function () {
    // Initialize global test variables
    before(async function () {
        this.RevenueShareFactory = await ethers.getContractFactory(
            "RevenueShareFactory"
        );

        this.validInput = {
            name: "Valid Revenue Share",
            splits: [
                {
                    account: (await ethers.getSigners())[0].address,
                    percentage: 100000,
                }
            ]
        }
    });

    // Create a brand new RevenueShare contract before each test
    beforeEach(async function () {
        await network.provider.send("hardhat_reset");
        this.revenueShareFactory = await this.RevenueShareFactory.deploy();
        await this.revenueShareFactory.deployed();
    });

    it("won't create a RevenueShare contract without being initialized", async function () {
        try {
            await this.revenueShareFactory.createNewRevenueShare(this.validInput);
        } catch (e: any) {
            expect(e.message).to.contain("Must be initialized first");
        }
    });

    it("cannot initialize multiple times", async function () {
        await this.revenueShareFactory.initialize();

        try {
            await this.revenueShareFactory.initialize();
        } catch (e: any) {
            expect(e.message).to.contain("Unprotected upgradeable contract");
        }
    });

    it("can create a RevenueShare contract and initialize it", async function () {
        await this.revenueShareFactory.initialize();

        let deployedAddress = await this.revenueShareFactory.createNewRevenueShare(this.validInput);
        await deployedAddress.wait();

        let events = await getLogs(this.revenueShareFactory.address);
        let revShareABI = require(path.resolve(__dirname, "../../abi/contracts/RevenueShare/RevenueShare.sol/RevenueShare.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, revShareABI, ethers.provider.getSigner());
        let deployedName = await deployedClone.name();

        expect(deployedName).to.equal("Valid Revenue Share");
    });
});

const getLogs = async (address: string) => {
    let revShareFactoryABI = require(path.resolve(__dirname, "../../abi/contracts/RevenueShare/RevenueShareFactory.sol/RevenueShareFactory.json"))
    let contractInterface = new ethers.utils.Interface(revShareFactoryABI)
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