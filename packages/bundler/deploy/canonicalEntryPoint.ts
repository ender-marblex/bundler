import path from 'path'
import fs from 'fs'
import type { DeployFunction } from 'hardhat-deploy/types'

// submodules/account-abstraction/deployments/ethereum/EntryPoint.json (0x4337... 배포에 사용된 bytecode)
const CANONICAL_PATH = path.join(__dirname, '..', '..', '..', 'submodules', 'account-abstraction', 'deployments', 'ethereum', 'EntryPoint.json')

export function getCanonicalEntryPointBytecode (): string | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'))
    return typeof j.bytecode === 'string' ? j.bytecode : undefined
  } catch {
    return undefined
  }
}

// hardhat-deploy가 이 파일을 배포 스크립트로 로드하므로 no-op export (실제 배포는 2-deploy-entrypoint에서 수행)
const noop: DeployFunction = async () => {}
export default noop
