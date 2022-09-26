import { expect } from "chai";
import { ethers, network } from "hardhat";
import path from "path";

describe("ExpenseSubmission", function () {
    // Initialize global test variables
    before(async function () {
        this.ExpenseSubmission = await ethers.getContractFactory("ExpenseSubmission");

        let signers = await ethers.getSigners();
        this.owner = signers[0];
        this.adam = signers[1];
        this.nik = signers[2];
        this.moneySender = signers[3];
        this.profitAddress = signers[4].address;
    });

    // Create a brand new ExpenseSubmission contract before each test
    beforeEach(async function () {
        await network.provider.send("hardhat_reset");
        this.expenseSubmission = await this.ExpenseSubmission.deploy();
        await this.expenseSubmission.deployed();
    });

    it("fails when amountPaid values > 0", async function () {
        try {
            await this.expenseSubmission.initialize({
                contractName: "Failed Initialize",
                expenses: [
                    {
                        name: "First",
                        account: this.nik.address,
                        cost: 100000n,
                        amountPaid: 0n,
                    },
                    {
                        name: "Second",
                        account: this.adam.address,
                        cost: 100000n,
                        amountPaid: 100n,
                    }
                ],
                profitAddress: this.profitAddress,
            }, this.owner.address);
        } catch (e: any) {
            expect(e.message).to.contain("amountPaid must be 0");
        }
    });

    it("fails when receiving funds before being initialized", async function () {
        try {
            await this.moneySender.sendTransaction({
                to: this.expenseSubmission.address,
                value: ethers.utils.parseEther("3"),
            });
        } catch (e: any) {
            expect(e.message).to.contain("Profit address not set");
        }
    });

    it("fails when trying to reconfigure before being initialized", async function () {
        try {
            await this.expenseSubmission.connect(this.owner).reconfigureExpenses([
                {
                    name: "Adam",
                    account: this.adam.address,
                    cost: 100000n,
                    amountPaid: 0n,
                }
            ]);
        } catch (e: any) {
            expect(e.message).to.contain("Profit address not set");
        }
    });

    it("fails to reconfigure when non-owner calls it", async function () {
        try {
            await initializeValidExpenseSubmission.bind(this)();

            await this.expenseSubmission.connect(this.adam).reconfigureExpenses([
                {
                    name: "Adam",
                    account: this.adam.address,
                    cost: 100000n,
                    amountPaid: 0n,
                }
            ]);
        } catch (e: any) {
            expect(e.message).to.contain("Only owner can reconfigure");
        }
    });

    it("can initialize with no expenses", async function () {
        await this.expenseSubmission.initialize({
            contractName: "Failed Initialize",
            expenses: [],
            profitAddress: this.profitAddress,
        }, this.owner.address);
    });

    it("sets contract name correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        let contractName = await this.expenseSubmission.contractName();
        expect(contractName).to.equal("Valid Expense Submission");
    });

    it("sets owner correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        let owner = await this.expenseSubmission.owner();
        expect(owner).to.equal(this.owner.address);
    });

    it("sets expenses correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        let expenses = await this.expenseSubmission.getExpenses();
        let firstExpense = await expenses[0];
        let secondExpense = expenses[1];

        expect(firstExpense.name).to.equal("Adam");
        expect(firstExpense.account).to.equal(this.adam.address);
        expect(firstExpense.cost).to.equal(100000n);
        expect(firstExpense.amountPaid).to.equal(0n);

        expect(secondExpense.name).to.equal("Nik");
        expect(secondExpense.account).to.equal(this.nik.address);
        expect(secondExpense.cost).to.equal(200000n);
        expect(secondExpense.amountPaid).to.equal(0n);
    });

    it("can reconfigure expenses correctly", async function () {
        await initializeValidExpenseSubmission.bind(this, true)();

        let initialExpenses = await this.expenseSubmission.getExpenses();

        await this.expenseSubmission.connect(this.owner).reconfigureExpenses([
            {
                name: "New Adam",
                account: this.adam.address,
                cost: 500000n,
                amountPaid: 0n,
            }
        ]);

        let reconfiguredExpenses = await this.expenseSubmission.getExpenses();

        expect(initialExpenses.length).to.equal(2);
        expect(reconfiguredExpenses.length).to.equal(1);

        expect(reconfiguredExpenses[0].name).to.equal("New Adam");
        expect(reconfiguredExpenses[0].account).to.equal(this.adam.address);
        expect(reconfiguredExpenses[0].cost).to.equal(500000n);
        expect(reconfiguredExpenses[0].amountPaid).to.equal(0n);
    });

    it("reimburses costs correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000000000n);
        await checkBalance(this.nik.address, 10000000000000000000000n);

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 300000n,
        });

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000100000n);
        await checkBalance(this.nik.address, 10000000000000000200000n);
    });

    it("pays profit correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000000000n);
        await checkBalance(this.nik.address, 10000000000000000000000n);
        await checkBalance(this.profitAddress, 10000000000000000000000n);

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 500000n,
        });

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000100000n);
        await checkBalance(this.nik.address, 10000000000000000200000n);
        await checkBalance(this.profitAddress, 10000000000000000200000n);
    });

    it("pays partial costs", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000000000n);
        await checkBalance(this.nik.address, 10000000000000000000000n);
        await checkBalance(this.profitAddress, 10000000000000000000000n);

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 50000n,
        });

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000050000n);
        await checkBalance(this.nik.address, 10000000000000000000000n);
        await checkBalance(this.profitAddress, 10000000000000000000000n);

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 100000n,
        });

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000100000n);
        await checkBalance(this.nik.address, 10000000000000000050000n);
        await checkBalance(this.profitAddress, 10000000000000000000000n);

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 200000n,
        });

        await checkBalance(this.expenseSubmission.address, 0n);
        await checkBalance(this.adam.address, 10000000000000000100000n);
        await checkBalance(this.nik.address, 10000000000000000200000n);
        await checkBalance(this.profitAddress, 10000000000000000050000n);
    });

    it("emits withdraw events correctly", async function () {
        await initializeValidExpenseSubmission.bind(this)();

        await this.moneySender.sendTransaction({
            to: this.expenseSubmission.address,
            value: 400000n,
        });

        let events = await getLogs(this.expenseSubmission.address);

        expect(events.length).to.equal(3);
        expect(events[0].amount).to.equal(100000n);
        expect(events[0].account).to.equal(this.adam.address);

        expect(events[1].amount).to.equal(200000n);
        expect(events[1].account).to.equal(this.nik.address);

        expect(events[2].amount).to.equal(100000n);
        expect(events[2].account).to.equal(this.profitAddress);
    });

    // helper function to set up two expenses
    async function initializeValidExpenseSubmission(
        this: Mocha.Context,
    ): Promise<void> {

        await this.expenseSubmission.connect(this.owner).initialize({
            contractName: "Valid Expense Submission",
            expenses: [
                {
                    name: "Adam",
                    account: this.adam.address,
                    cost: 100000n,
                    amountPaid: 0n,
                },
                {
                    name: "Nik",
                    account: this.nik.address,
                    cost: 200000n,
                    amountPaid: 0n,
                },
            ],
            profitAddress: this.profitAddress,
        }, this.owner.address);
    }
});

// helper function to check the node balance
async function checkBalance(
    address: any,
    expectedBalance: bigint
): Promise<void> {
    let balance = await ethers.provider.getBalance(address);
    expect(balance).to.equal(expectedBalance);
}

const getLogs = async (address: string) => {
    let revShareABI = require(path.resolve(__dirname, "../../abi/contracts/ExpenseSubmission/ExpenseSubmission.sol/ExpenseSubmission.json"))
    let contractInterface = new ethers.utils.Interface(revShareABI)
    let events = await ethers.provider.getLogs({
        fromBlock: 0,
        toBlock: 'latest',
        address: address,
    }).then((events) => {
        return events.map((e) => {
            return contractInterface.parseLog(e).args
        }).filter((events) => {
            return events.amount;
        });
    })
    return events;
}