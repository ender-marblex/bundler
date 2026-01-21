import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'
import { deployEntryPoint, getEntryPointAddress } from '@account-abstraction/utils'
import { getCanonicalEntryPointBytecode } from './canonicalEntryPoint'

// deploy entrypoint - but only on debug network..
const deployEP: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const canonical = getCanonicalEntryPointBytecode()
  const epAddr = getEntryPointAddress(canonical)

  const net = await ethers.provider.getNetwork()
  if (net.chainId !== 1337 && net.chainId !== 31337) {
    console.log('NOT deploying EntryPoint. use pre-deployed entrypoint')
    process.exit(1)
  }

  if (await ethers.provider.getCode(epAddr) !== '0x') {
    console.log('EntryPoint already deployed at', epAddr)
  } else {
    await deployEntryPoint(ethers.provider, undefined, canonical)
    console.log('Deployed EntryPoint at', epAddr)
  }
}

export default deployEP
