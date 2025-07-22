const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("PacmanLeaderboard", function () {
  let leaderboard;
  let owner, addr1, addr2;
  const submissionFee = ethers.parseEther("0.015"); // Correct Ethers v6 syntax

  beforeEach(async function () {
    const LeaderboardFactory = await ethers.getContractFactory("PacmanLeaderboard");
    [owner, addr1, addr2] = await ethers.getSigners(); // Get multiple accounts
    leaderboard = await LeaderboardFactory.deploy();
    await leaderboard.waitForDeployment(); // Correct Ethers v6 syntax
  });

  it("Should allow score submission with correct fee and emit event", async function () {
    const score = 1000;
    const level = 5;

    // Test that the transaction emits the "ScoreSubmitted" event
    await expect(
      leaderboard.connect(addr1).submitScore(score, level, { value: submissionFee })
    ).to.emit(leaderboard, "ScoreSubmitted")
      .withArgs(addr1.address, score, level, anyValue); // Use imported anyValue

    // Check if player stats were updated correctly
    const playerStats = await leaderboard.getPlayerStats(addr1.address);
    expect(playerStats.bestScore).to.equal(score);
    expect(playerStats.totalGames).to.equal(1);
  });

  it("Should reject submission with insufficient fee", async function () {
    const score = 1000;
    const level = 1;
    const insufficientFee = ethers.parseEther("0.01"); // Correct Ethers v6 syntax

    await expect(
      leaderboard.connect(addr1).submitScore(score, level, { value: insufficientFee })
    ).to.be.revertedWith("Insufficient fee");
  });

  it("Should return correct top scores", async function () {
    // Player 1 submits a score
    await leaderboard.connect(addr1).submitScore(1000, 1, { value: submissionFee });
    // Player 2 submits a higher score
    await leaderboard.connect(addr2).submitScore(2000, 2, { value: submissionFee });

    const topScores = await leaderboard.getTopScores(10);
    expect(topScores.length).to.equal(2);
    expect(topScores[0].score).to.equal(2000); // Player 2 should be first
    expect(topScores[1].score).to.equal(1000); // Player 1 should be second
  });
});