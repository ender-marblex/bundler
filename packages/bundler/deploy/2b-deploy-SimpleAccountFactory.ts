import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'
import { getEntryPointAddress, DeterministicDeployer, SimpleAccountFactory__factory } from '@account-abstraction/utils'
import { getCanonicalEntryPointBytecode } from './canonicalEntryPoint'

const deploySimpleAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const net = await ethers.provider.getNetwork()
  // if (net.chainId !== 1337 && net.chainId !== 31337) {
  //   console.log('Skipping SimpleAccountFactory on non-local network')
  //   return
  // }

  const canonical = getCanonicalEntryPointBytecode()
  const entryPointAddress = getEntryPointAddress(canonical)
  const epCode = await ethers.provider.getCode(entryPointAddress)
  if (epCode === '0x') {
    console.log('EntryPoint not deployed at', entryPointAddress, '- run 2-deploy-entrypoint first')
    return
  }

  const dep = new DeterministicDeployer(ethers.provider, await ethers.provider.getSigner())
  const factoryAddr = DeterministicDeployer.getAddress(new SimpleAccountFactory__factory(), 0, [entryPointAddress])

  if (await dep.isContractDeployed(factoryAddr)) {
    console.log('SimpleAccountFactory already deployed at', factoryAddr)
    return
  }

  await dep.deterministicDeploy(new SimpleAccountFactory__factory(), 0, [entryPointAddress])
  console.log('SimpleAccountFactory deployed at', factoryAddr)
}

export default deploySimpleAccountFactory
