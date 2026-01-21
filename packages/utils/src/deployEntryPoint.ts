import { JsonRpcProvider } from '@ethersproject/providers'
import { bytecode as entryPointByteCode } from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { IEntryPoint, IEntryPoint__factory } from './soltypes'
import { DeterministicDeployer } from './DeterministicDeployer'

// 메인넷 배포 tx 0xae4eafd1... 에서 확인한 salt → 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108
export const CANONICAL_ENTRY_POINT_SALT = '0x0a59dbff790c23c976a548690c27297883cc66b4c67024f9117b0238995e35e9'
export const entryPointSalt = '0x0000000000000000000000000000000000000000000000000000000000000000'

/**
 * @param bytecodeOverride - deployments/ethereum/EntryPoint.json bytecode + CANONICAL_ENTRY_POINT_SALT → 0x4337...
 */
export async function deployEntryPoint (provider: JsonRpcProvider, signer?: any, bytecodeOverride?: string): Promise<IEntryPoint> {
  const code = bytecodeOverride ?? entryPointByteCode
  const salt = bytecodeOverride != null ? CANONICAL_ENTRY_POINT_SALT : entryPointSalt
  const s = signer ?? provider.getSigner()
  const addr = await new DeterministicDeployer(provider, s).deterministicDeploy(code, salt)
  return IEntryPoint__factory.connect(addr, s)
}

/**
 * @param bytecodeOverride - canonical bytecode면 CANONICAL_ENTRY_POINT_SALT 사용 → 0x4337...
 */
export function getEntryPointAddress (bytecodeOverride?: string): string {
  const code = bytecodeOverride ?? entryPointByteCode
  const salt = bytecodeOverride != null ? CANONICAL_ENTRY_POINT_SALT : entryPointSalt
  return DeterministicDeployer.getAddress(code, salt)
}
