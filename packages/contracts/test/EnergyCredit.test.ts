import { expect } from "chai";
import { ethers } from "hardhat";

describe("EnergyCredit", () => {
  async function deploy() {
    const [owner, operator, buyer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EnergyCredit");
    const contract = await factory.connect(owner).deploy(operator.address);
    await contract.waitForDeployment();
    return { contract, owner, operator, buyer };
  }

  it("mints a credit only via the operator", async () => {
    const { contract, operator, buyer } = await deploy();
    await expect(contract.connect(operator).mintCredit("EC-TEST-0001", 130_000, buyer.address))
      .to.emit(contract, "CreditMinted")
      .withArgs("EC-TEST-0001", 130_000, buyer.address);

    const credit = await contract.getCredit("EC-TEST-0001");
    expect(credit.qtyWh).to.equal(130_000n);
    expect(credit.owner).to.equal(buyer.address);
  });

  it("rejects minting from a non-operator", async () => {
    const { contract, buyer } = await deploy();
    await expect(contract.connect(buyer).mintCredit("EC-TEST-0002", 1000, buyer.address)).to.be.revertedWith(
      "EnergyCredit: caller is not the operator",
    );
  });

  it("transfers and retires a minted credit", async () => {
    const { contract, operator, buyer, owner } = await deploy();
    await contract.connect(operator).mintCredit("EC-TEST-0003", 5000, buyer.address);

    await expect(contract.connect(operator).transferCredit("EC-TEST-0003", owner.address, 5000))
      .to.emit(contract, "CreditTransferred")
      .withArgs("EC-TEST-0003", buyer.address, owner.address, 5000);

    await expect(contract.connect(operator).retireCredit("EC-TEST-0003", 5000, "SET-000001"))
      .to.emit(contract, "CreditRetired")
      .withArgs("EC-TEST-0003", 5000, "SET-000001");

    const credit = await contract.getCredit("EC-TEST-0003");
    expect(credit.status).to.equal(2); // Retired
  });
});
