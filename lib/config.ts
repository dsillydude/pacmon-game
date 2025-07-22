import { http, createConfig } from 'wagmi'
import { monadTestnet } from 'viem/chains'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [farcasterFrame()],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://testnet.monad.xyz'),
  },
})