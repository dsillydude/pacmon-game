const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying PacmanLeaderboard contract...");

  const PacmanLeaderboard = await ethers.getContractFactory("PacmanLeaderboard");
  const leaderboard = await PacmanLeaderboard.deploy();

  await leaderboard.waitForDeployment();

  // Correct Ethers v6 method to get the address
  const contractAddress = await leaderboard.getAddress();
  console.log("PacmanLeaderboard deployed to:", contractAddress);

  // Verify deployment
  const owner = await leaderboard.owner();
  const submissionFee = await leaderboard.SUBMISSION_FEE();

  console.log("Contract owner:", owner);
  console.log("Submission fee:", ethers.formatEther(submissionFee), "MON");

  return contractAddress;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };