require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 10143
    }
  }
};