import { ethers, upgrades } from "hardhat";

async function main() {
    let splits = [
        {
            name: "Boston Globe",
            account: "0xAb0279E49891416EADA65e36aE1AEd1A67A15d24",
            percentage: 30000
        },
        {
            name: "Picasso",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Giotto",
            account: "0x99BB44964caEb93bC862a60b89173b934d99bAE7",
            percentage: 5000
        },
        {
            name: "Leonardo",
            account: "0x99BB44964caEb93bC862a60b89173b934d99bAE7",
            percentage: 5000
        },
        {
            name: "Monet",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Kandinsky",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Rembrandt",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Cézanne",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Velázquez",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Caravaggio",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Van Eyck",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Turner",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Michelangelo",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Goya",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        },
        {
            name: "Van Gogh",
            account: "0x12Af066903A962a75959cC915A45Aed26D8DFa44",
            percentage: 5000
        }
    ];

    createSimpleRevenueShare("Boston Globe", splits);
}

async function sendMoney(address: string) {

}

async function createSimpleRevenueShare(contractName: string, splits: any) {
    let contractFactory = await ethers.getContractFactory("RevenueShareFactory");
    let contract = contractFactory.attach(process.env["TESTNET_REVENUE_SHARE_FACTORY_ADDRESS"] as string);

    let input = {
        contractName,
        splits
    }

    console.log(input);

    contract.createNewRevenueShare(input);

}

async function createCappedRevenueShare(name: string, cappedSplits: any) {
    let contractFactory = await ethers.getContractFactory("CappedRevenueShareFactory");
    let contract = contractFactory.attach(process.env["TESTNET_CAPPED_REVENUE_SHARE_FACTORY_ADDRESS"] as string);
}

// Allows using async/await everywhere and properly handling errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
