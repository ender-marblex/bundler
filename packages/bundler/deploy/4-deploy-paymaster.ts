import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

// 기본 EntryPoint 주소 (ERC-4337 v0.7)
const DEFAULT_ENTRY_POINT = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108'

const deployPaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // EntryPoint 주소: 환경변수 또는 기본값 사용
  const entryPointAddress = process.env.ENTRY_POINT ?? DEFAULT_ENTRY_POINT

  // EntryPoint가 배포되어 있는지 확인
  const entryPointCode = await ethers.provider.getCode(entryPointAddress)
  if (entryPointCode === '0x') {
    console.log(`EntryPoint not deployed at ${entryPointAddress}`)
    console.log('Please deploy EntryPoint first with: yarn hardhat-deploy --network localhost')
    console.log('Or set ENTRY_POINT environment variable to use a different address')
    return
  }

  console.log('Deploying SimplePaymaster...')
  console.log('  EntryPoint:', entryPointAddress)
  console.log('  Deployer:', deployer)

  // SimplePaymaster 배포 (EntryPoint 인터페이스 검증 없음)
  const paymaster = await deploy('SimplePaymaster', {
    from: deployer,
    args: [entryPointAddress],
    log: true
  })

  console.log('SimplePaymaster deployed at:', paymaster.address)

  // Paymaster에 deposit 추가 (가스비 지불을 위해)
  const paymasterContract = await ethers.getContractAt('SimplePaymaster', paymaster.address)
  const entryPoint = await ethers.getContractAt('IEntryPoint', entryPointAddress)

  // 현재 deposit 확인
  const depositInfo = await entryPoint.getDepositInfo(paymaster.address)
  console.log('Current Paymaster deposit:', ethers.utils.formatEther(depositInfo.deposit), 'ETH')

  // deposit이 부족하면 추가
  const minDeposit = ethers.utils.parseEther('1')
  if (depositInfo.deposit.lt(minDeposit)) {
    console.log('Adding deposit to Paymaster...')
    const signer = await ethers.getSigner(deployer)
    const tx = await paymasterContract.connect(signer).deposit({ value: minDeposit })
    await tx.wait()
    console.log('Deposited 1 ETH to Paymaster')

    // 확인
    const newDepositInfo = await entryPoint.getDepositInfo(paymaster.address)
    console.log('New Paymaster deposit:', ethers.utils.formatEther(newDepositInfo.deposit), 'ETH')
  }

  console.log('\n=== Paymaster Setup Complete ===')
  console.log('Paymaster Address:', paymaster.address)
  console.log('\nTo test with paymaster, run:')
  console.log(`yarn run runop --deployFactory --network http://localhost:8545/ --entryPoint ${entryPointAddress} --paymaster ${paymaster.address}`)
}

deployPaymaster.tags = ['Paymaster']
// EntryPoint 의존성 제거 - 직접 주소 확인

export default deployPaymaster
