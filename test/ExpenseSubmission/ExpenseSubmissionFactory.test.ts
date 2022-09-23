import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("ExpenseSubmissionFactory", function () {
    // Initialize global test variables
    before(async function () {
        this.ExpenseSubmissionFactory = await ethers.getContractFactory(
            "ExpenseSubmissionFactory"
        );

        this.validInput = {
            contractName: "Valid Expense Submission",
            expenses: [
                {
                    name: "First",
                    account: (await ethers.getSigners())[1].address,
                    cost: 100000n,
                    amountPaid: 0n,
                    timestamp: new Date().getTime(),
                }
            ],
            profitAddress: (await ethers.getSigners())[2].address,
        }

        this.validTripleExpense = {
            contractName: "Valid Expense Submission 2",
            expenses: [
                {
                    name: "First",
                    account: (await ethers.getSigners())[1].address,
                    cost: 100000n,
                    amountPaid: 0n,
                    timestamp: new Date().getTime(),
                },
                {
                    name: "Second",
                    account: (await ethers.getSigners())[2].address,
                    cost: 200000n,
                    amountPaid: 0n,
                    timestamp: new Date().getTime(),
                },
                {
                    name: "FirstDuplicate",
                    account: (await ethers.getSigners())[1].address,
                    cost: 4000n,
                    amountPaid: 0n,
                    timestamp: new Date().getTime(),
                }
            ],
            profitAddress: (await ethers.getSigners())[3].address,
        }
    });

    // Create a brand new ExpenseSubmission contract before each test
    beforeEach(async function () {
        await network.provider.send("hardhat_reset");
        this.expenseSubmissionFactory = await this.ExpenseSubmissionFactory.deploy();
        await this.expenseSubmissionFactory.deployed();
    });

    it("won't create a ExpenseSubmission contract without being initialized", async function () {
        try {
            await this.expenseSubmissionFactory.createNewExpenseSubmission(this.validInput);
        } catch (e: any) {
            expect(e.message).to.contain("Must be initialized first");
        }
    });

    it("can create a ExpenseSubmission contract and initialize it", async function () {
        await this.expenseSubmissionFactory.initialize();

        let deployedAddress = await this.expenseSubmissionFactory.createNewExpenseSubmission(this.validInput);
        await deployedAddress.wait();

        let events = await getLogs(this.expenseSubmissionFactory.address);
        let revShareABI = require(path.resolve(__dirname, "../../abi/contracts/ExpenseSubmission/ExpenseSubmission.sol/ExpenseSubmission.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, revShareABI, ethers.provider.getSigner());
        let deployedName = await deployedClone.contractName();

        expect(deployedName).to.equal("Valid Expense Submission");
    });

    it("can create a ExpenseSubmission contract and reconfigure it", async function () {
        await this.expenseSubmissionFactory.initialize();

        let deployedAddress = await this.expenseSubmissionFactory.createNewExpenseSubmission(this.validInput);
        await deployedAddress.wait();

        let events = await getLogs(this.expenseSubmissionFactory.address);
        let expenseSubmissionABI = require(path.resolve(__dirname, "../../abi/contracts/ExpenseSubmission/ExpenseSubmission.sol/ExpenseSubmission.json"))
        let deployedClone = new ethers.Contract(events[0].cloneAddress, expenseSubmissionABI, ethers.provider.getSigner());

        let initialExpenses = await deployedClone.getExpenses();

        await deployedClone.reconfigureExpenses(this.validTripleExpense.expenses);

        let reconfiguredExpenses = await deployedClone.getExpenses();

        expect(initialExpenses.length).to.equal(1);
        expect(reconfiguredExpenses.length).to.equal(3);
    });

    it("can emit correct events", async function () {
        await this.expenseSubmissionFactory.initialize();

        let deployedAddress = await this.expenseSubmissionFactory.createNewExpenseSubmission(this.validInput);
        await deployedAddress.wait();

        let events = await getLogs(this.expenseSubmissionFactory.address);
        let deployAddress = (await ethers.getSigners())[0].address;
        let profitAddress = (await ethers.getSigners())[2].address;

        expect(events.length).to.equal(2);

        // msg.sender
        expect(events[0].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
        expect(events[0].splitAddress).to.equal(deployAddress);
        expect(events[0].contractName).to.equal("Valid Expense Submission");

        // profit address
        expect(events[1].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[1].cloneAddress)).to.be.true;
        expect(events[1].splitAddress).to.equal(profitAddress);
        expect(events[1].contractName).to.equal("Valid Expense Submission");
    });

    it("sends correct events for multiple addresses", async function () {
        await this.expenseSubmissionFactory.initialize();

        let deployedAddress = await this.expenseSubmissionFactory.createNewExpenseSubmission(this.validTripleExpense);
        await deployedAddress.wait();

        let events = await getLogs(this.expenseSubmissionFactory.address);
        let deployAddress = (await ethers.getSigners())[0].address;
        let profitAddress = (await ethers.getSigners())[3].address;

        expect(events.length).to.equal(2);

        // msg.sender
        expect(events[0].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[0].cloneAddress)).to.be.true;
        expect(events[0].splitAddress).to.equal(deployAddress);
        expect(events[0].contractName).to.equal("Valid Expense Submission 2");

        // profit address
        expect(events[1].cloneAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(events[1].cloneAddress)).to.be.true;
        expect(events[1].splitAddress).to.equal(profitAddress);
        expect(events[1].contractName).to.equal("Valid Expense Submission 2");
    });

    it("can update the implementation address", async function () {
        await this.expenseSubmissionFactory.initialize();

        let firstImplAddress = await this.expenseSubmissionFactory.implementationAddress();
        expect(firstImplAddress).to.not.equal("0x0000000000000000000000000000000000000000");
        expect(ethers.utils.isAddress(firstImplAddress)).to.be.true;

        await this.expenseSubmissionFactory.updateImplementation();

        let secondImplAddress = await this.expenseSubmissionFactory.implementationAddress();
        expect(secondImplAddress).to.not.equal(firstImplAddress);
        expect(ethers.utils.isAddress(secondImplAddress)).to.be.true;

    });
});

const getLogs = async (address: string) => {
    let factoryABI = require(path.resolve(__dirname, "../../abi/contracts/ExpenseSubmission/ExpenseSubmissionFactory.sol/ExpenseSubmissionFactory.json"))
    let contractInterface = new ethers.utils.Interface(factoryABI)
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