import { useSendTransaction, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';
import { monadTestnet } from 'wagmi/chains';

export function WalletActions() {
  const { sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();

  const sendTransactionHandler = () => {
    sendTransaction({
      to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Example recipient address
      value: parseEther('0.001'), // Example value (0.001 Ether)
    });
  };

  const switchChainHandler = () => {
    switchChain({ chainId: monadTestnet.id });
  };

  return (
    <div>
      <h3>Wallet Actions</h3>
      <button onClick={sendTransactionHandler}>Send Example Transaction</button>
      <button onClick={switchChainHandler}>Switch to Monad Testnet</button>
    </div>
  );
}


