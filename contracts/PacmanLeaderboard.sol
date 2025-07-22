// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PacmanLeaderboard {
    struct Score {
        address player;
        uint256 score;
        uint256 timestamp;
        uint256 level;
    }
    
    struct PlayerStats {
        uint256 bestScore;
        uint256 totalGames;
        uint256 totalScore;
        uint256 lastPlayed;
    }
    
    mapping(address => PlayerStats) public playerStats;
    mapping(uint256 => Score) public scores;
    address[] public players;
    
    uint256 public totalScores;
    uint256 public constant SUBMISSION_FEE = 0.015 ether;
    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    
    address public owner;
    bool public paused = false;
    
    event ScoreSubmitted(
        address indexed player, 
        uint256 score, 
        uint256 level, 
        uint256 timestamp
    );
    
    event NewHighScore(
        address indexed player, 
        uint256 previousBest, 
        uint256 newScore
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier validSubmission(uint256 score, uint256 level) {
        require(score > 0, "Score must be greater than 0");
        require(level > 0, "Level must be greater than 0");
        require(msg.value >= SUBMISSION_FEE, "Insufficient fee");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function submitScore(uint256 score, uint256 level) 
        external 
        payable 
        notPaused 
        validSubmission(score, level) 
    {
        PlayerStats storage stats = playerStats[msg.sender];
        
        // Track if this is a new player
        if (stats.totalGames == 0) {
            players.push(msg.sender);
        }
        
        // Update player statistics
        stats.totalGames++;
        stats.totalScore += score;
        stats.lastPlayed = block.timestamp;
        
        // Check for new personal best
        bool isNewBest = false;
        if (score > stats.bestScore) {
            uint256 previousBest = stats.bestScore;
            stats.bestScore = score;
            isNewBest = true;
            emit NewHighScore(msg.sender, previousBest, score);
        }
        
        // Store score record
        scores[totalScores] = Score({
            player: msg.sender,
            score: score,
            timestamp: block.timestamp,
            level: level
        });
        
        totalScores++;
        
        emit ScoreSubmitted(msg.sender, score, level, block.timestamp);
        
        // Refund excess payment
        if (msg.value > SUBMISSION_FEE) {
            payable(msg.sender).transfer(msg.value - SUBMISSION_FEE);
        }
    }
    
    function getTopScores(uint256 limit) 
        external 
        view 
        returns (Score[] memory) 
    {
        require(limit <= MAX_LEADERBOARD_SIZE, "Limit too high");
        
        uint256 actualLimit = limit;
        if (actualLimit > players.length) {
            actualLimit = players.length;
        }
        
        // Create array of player best scores
        Score[] memory allBestScores = new Score[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            PlayerStats memory stats = playerStats[players[i]];
            allBestScores[i] = Score({
                player: players[i],
                score: stats.bestScore,
                timestamp: stats.lastPlayed,
                level: 0 // We don't track level for best score specifically
            });
        }
        
        // Sort scores (bubble sort for simplicity)
        for (uint256 i = 0; i < allBestScores.length - 1; i++) {
            for (uint256 j = 0; j < allBestScores.length - i - 1; j++) {
                if (allBestScores[j].score < allBestScores[j + 1].score) {
                    Score memory temp = allBestScores[j];
                    allBestScores[j] = allBestScores[j + 1];
                    allBestScores[j + 1] = temp;
                }
            }
        }
        
        // Return top scores
        Score[] memory topScores = new Score[](actualLimit);
        for (uint256 i = 0; i < actualLimit; i++) {
            topScores[i] = allBestScores[i];
        }
        
        return topScores;
    }
    
    function getPlayerStats(address player) 
        external 
        view 
        returns (PlayerStats memory) 
    {
        return playerStats[player];
    }
    
    function getRecentScores(uint256 limit) 
        external 
        view 
        returns (Score[] memory) 
    {
        require(limit <= MAX_LEADERBOARD_SIZE, "Limit too high");
        
        uint256 actualLimit = limit;
        if (actualLimit > totalScores) {
            actualLimit = totalScores;
        }
        
        Score[] memory recentScores = new Score[](actualLimit);
        uint256 startIndex = totalScores > actualLimit ? totalScores - actualLimit : 0;
        
        for (uint256 i = 0; i < actualLimit; i++) {
            recentScores[actualLimit - 1 - i] = scores[startIndex + i];
        }
        
        return recentScores;
    }
    
    function getTotalPlayers() external view returns (uint256) {
        return players.length;
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner).transfer(balance);
    }
    
    function updateSubmissionFee(uint256 newFee) external onlyOwner {
        // Note: This would require a more complex upgrade pattern in production
        revert("Fee updates not implemented in this version");
    }
}