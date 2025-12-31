import Debug from 'debug'
import { Mutex } from 'async-mutex'
import { EIP7702Authorization, OperationBase, StorageMap } from '@account-abstraction/utils'
import { clearInterval } from 'timers'

import { SendBundleReturn } from './BundleManager'
import { MempoolManager } from './MempoolManager'
import { ReputationManager } from './ReputationManager'
import { IBundleManager } from './IBundleManager'
import {
  EmptyValidateUserOpResult,
  IValidationManager, ValidationManager
} from '@account-abstraction/validation-manager'
import { DepositManager } from './DepositManager'
import { BigNumberish, Signer } from 'ethers'
import { BundlerConfig } from '../BundlerConfig'
import { PreVerificationGasCalculator } from '@account-abstraction/sdk'
import { ERC7562Parser } from '@account-abstraction/validation-manager/dist/src/ERC7562Parser'

const debug = Debug('aa.exec')

/**
 * execute userOps manually or using background timer.
 * This is the top-level interface to send UserOperation
 */
export class ExecutionManager {
  private reputationCron: any
  private autoBundleInterval: any
  private maxMempoolSize = 0 // default to auto-mining
  private autoInterval = 0
  private readonly mutex = new Mutex()

  constructor (private readonly reputationManager: ReputationManager,
    private readonly mempoolManager: MempoolManager,
    private readonly bundleManager: IBundleManager,
    private validationManager: IValidationManager,
    private readonly depositManager: DepositManager,
    private readonly signer: Signer,
    private readonly rip7560: boolean,
    private readonly useRip7560Mode: string | undefined,
    private readonly gethDevMode: boolean
  ) {
  }

  /**
   * send a user operation through the bundler.
   * @param userOp the UserOp to send.
   * @param entryPointInput the entryPoint passed through the RPC request.
   * @param skipValidation if set to true we will not perform tracing and ERC-7562 rules compliance validation
   */
  async sendUserOperation (
    userOp: OperationBase,
    entryPointInput: string,
    skipValidation: boolean
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      console.log('🔒 [3/6] ExecutionManager.sendUserOperation 시작 (Mutex 잠금)')
      debug('sendUserOperation')
      
      console.log('  📋 입력 파라미터 검증 중...')
      this.validationManager.validateInputParameters(userOp, entryPointInput)
      console.log('  ✅ 입력 파라미터 검증 완료')
      
      let validationResult = EmptyValidateUserOpResult
      if (!skipValidation) {
        console.log('  🔍 UserOperation 검증 시작 (ValidationManager.validateUserOp)...')
        const validationStartTime = Date.now()
        validationResult = await this.validationManager.validateUserOp(userOp)
        const validationTime = Date.now() - validationStartTime
        console.log(`  ✅ 검증 완료 (소요 시간: ${validationTime}ms)`)
        console.log('  📊 검증 결과:', {
          prefund: validationResult.returnInfo?.prefund?.toString() ?? 'N/A',
          preOpGas: validationResult.returnInfo?.preOpGas?.toString() ?? 'N/A',
          aggregator: validationResult.aggregatorInfo?.addr ?? '(없음)'
        })
      } else {
        console.log('  ⚠️  검증 건너뛰기 (skipValidation=true)')
      }
      
      console.log('  🔐 UserOperation Hash 생성 중...')
      const userOpHash = await this.validationManager.getOperationHash(userOp)
      console.log('  ✅ UserOperation Hash:', userOpHash)
      
      console.log('  💰 Paymaster Deposit 확인 중...')
      await this.depositManager.checkPaymasterDeposit(userOp)
      console.log('  ✅ Paymaster Deposit 확인 완료')
      
      console.log('  📦 Mempool에 UserOperation 추가 중...')
      const mempoolCountBefore = this.mempoolManager.count()
      this.mempoolManager.addUserOp(
        skipValidation,
        userOp,
        userOpHash,
        validationResult)
      const mempoolCountAfter = this.mempoolManager.count()
      console.log(`  ✅ Mempool에 추가 완료 (이전: ${mempoolCountBefore}, 현재: ${mempoolCountAfter})`)
      
      if (!this.rip7560 || (this.rip7560 && this.useRip7560Mode === 'PUSH')) {
        console.log('  🚀 번들 전송 시도 시작 (force=true)...')
        const bundleStartTime = Date.now()
        // Force bundle attempt to send immediately
        const bundleResult = await this.attemptBundle(true)
        const bundleTime = Date.now() - bundleStartTime
        if (bundleResult != null) {
          console.log(`  ✅ 번들 전송 완료 (소요 시간: ${bundleTime}ms)`)
          console.log('  📊 번들 결과:', {
            transactionHash: bundleResult.transactionHash,
            userOpHashes: bundleResult.userOpHashes.length
          })
        } else {
          console.log(`  ⚠️  번들 전송 실패 또는 번들 없음 (소요 시간: ${bundleTime}ms)`)
        }
      } else {
        console.log('  ⏸️  번들 전송 건너뛰기 (RIP7560 모드)')
      }
      
      console.log('🔓 [4/6] ExecutionManager.sendUserOperation 완료 (Mutex 해제)\n')
    })
  }

  setReputationCron (interval: number): void {
    debug('set reputation interval to', interval)
    clearInterval(this.reputationCron)
    if (interval !== 0) {
      this.reputationCron = setInterval(() => this.reputationManager.hourlyCron(), interval)
    }
  }

  /**
   * set automatic bundle creation
   * @param autoBundleInterval autoBundleInterval to check. send bundle anyway after this time is elapsed. zero for manual mode
   * @param maxMempoolSize maximum # of pending mempool entities. send immediately when there are that many entities in the mempool.
   *    set to zero (or 1) to automatically send each UserOp.
   * (note: there is a chance that the sent bundle will contain less than this number, in case only some mempool entities can be sent.
   *  e.g. throttled paymaster)
   */
  setAutoBundler (autoBundleInterval: number, maxMempoolSize: number): void {
    debug('set auto-bundle autoBundleInterval=', autoBundleInterval, 'maxMempoolSize=', maxMempoolSize)
    clearInterval(this.autoBundleInterval)
    this.autoInterval = autoBundleInterval
    if (autoBundleInterval !== 0) {
      this.autoBundleInterval = setInterval(() => {
        void this.attemptBundle(true).catch(e => console.error('auto-bundle failed', e))
      }, autoBundleInterval * 1000)
    }
    this.maxMempoolSize = maxMempoolSize
  }

  /**
   * attempt to send a bundle now.
   * @param force
   */
  async attemptBundle (force = true): Promise<SendBundleReturn | undefined> {
    console.log('  🎯 ExecutionManager.attemptBundle 호출:', {
      force,
      mempoolCount: this.mempoolManager.count(),
      maxMempoolSize: this.maxMempoolSize,
      rip7560: this.rip7560,
      useRip7560Mode: this.useRip7560Mode,
      gethDevMode: this.gethDevMode
    })
    
    if (this.rip7560 && this.useRip7560Mode === 'PULL' && this.gethDevMode && force) {
      console.log('  🔄 RIP7560 PULL 모드: 1 wei 트랜잭션 전송')
      debug('sending 1 wei transaction')
      const result = await this.signer.sendTransaction({
        to: this.signer.getAddress(),
        value: 1
      })
      console.log('  ⏳ 트랜잭션 채굴 대기 중...')
      // wait up to 2 seconds for the transaction to be mined
      for (let i = 0; ; i++) {
        const rcpt = await this.signer.provider?.getTransactionReceipt(result.hash)
        if (rcpt != null) {
          console.log('  ✅ 트랜잭션 채굴 완료:', result.hash)
          break
        }
        if (i > 20) {
          throw new Error('timed out waiting for transaction')
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      await this.bundleManager.handlePastEvents()
      return
    }
    debug('attemptBundle force=', force, 'count=', this.mempoolManager.count(), 'max=', this.maxMempoolSize)
    if (force || this.mempoolManager.count() >= this.maxMempoolSize) {
      console.log('  ✅ 번들 전송 조건 충족 (force 또는 mempool 크기 충족)')
      const ret = await this.bundleManager.sendNextBundle()
      if (this.maxMempoolSize === 0) {
        console.log('  🧹 Auto-bundling 모드: Mempool 정리 중...')
        // in "auto-bundling" mode (which implies auto-mining) also flush mempool from included UserOps
        await this.bundleManager.handlePastEvents()
      }
      this.depositManager.clearCache()
      console.log('  ✅ Deposit 캐시 정리 완료')
      return ret
    } else {
      console.log('  ⏸️  번들 전송 조건 미충족 (force=false이고 mempool 크기 부족)')
    }
  }

  async createBundle (
    minBaseFee: BigNumberish,
    maxBundleGas: BigNumberish,
    maxBundleSize: BigNumberish
  ): Promise<[OperationBase[], EIP7702Authorization[], StorageMap]> {
    return await this.bundleManager.createBundle(minBaseFee, maxBundleGas, maxBundleSize)
  }

  async _setConfiguration (configOverrides: Partial<BundlerConfig>): Promise<PreVerificationGasCalculator> {
    const { configuration, entryPoint, unsafe } = this.validationManager._getDebugConfiguration()
    const mergedConfiguration = Object.assign({}, configuration, configOverrides)
    const pvgc = new PreVerificationGasCalculator(mergedConfiguration)
    const erc7562Parser = new ERC7562Parser(entryPoint.address, mergedConfiguration.senderCreator ?? '')
    this.validationManager = new ValidationManager(
      entryPoint,
      unsafe,
      pvgc,
      erc7562Parser
    )
    return pvgc
  }
}
