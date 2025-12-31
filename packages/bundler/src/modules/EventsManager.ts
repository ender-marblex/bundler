import { ReputationManager } from './ReputationManager'
import Debug from 'debug'
import { MempoolManager } from './MempoolManager'
import { TypedEvent } from '../types/common'
import {
  AccountDeployedEvent, IEntryPoint,
  SignatureAggregatorChangedEvent,
  UserOperationEventEvent
} from '@account-abstraction/utils'

const debug = Debug('aa.events')

/**
 * listen to events. trigger ReputationManager's Included
 */
export class EventsManager {
  lastBlock?: number

  constructor (
    readonly entryPoint: IEntryPoint,
    readonly mempoolManager: MempoolManager,
    readonly reputationManager: ReputationManager) {
  }

  /**
   * automatically listen to all UserOperationEvent events
   */
  initEventListener (): void {
    this.entryPoint.on(this.entryPoint.filters.UserOperationEvent(), (...args) => {
      const ev = args.slice(-1)[0]
      void this.handleEvent(ev as any)
    })
  }

  /**
   * process all new events since last run
   */
  async handlePastEvents (): Promise<void> {
    const mempoolCountBefore = this.mempoolManager.count()
    if (this.lastBlock === undefined) {
      const currentBlock = await this.entryPoint.provider.getBlockNumber()
      this.lastBlock = Math.max(1, currentBlock - 1000)
      console.log(`      📍 초기 lastBlock 설정: ${this.lastBlock} (현재 블록: ${currentBlock})`)
    }
    console.log(`      🔍 이벤트 조회 중 (lastBlock: ${this.lastBlock})...`)
    try {
      const events = await this.entryPoint.queryFilter({ address: this.entryPoint.address }, this.lastBlock)
      console.log(`      ✅ 이벤트 ${events.length}개 발견`)
      let userOpEventCount = 0
      for (const ev of events) {
        if (ev.event === 'UserOperationEvent') {
          userOpEventCount++
        }
        this.handleEvent(ev)
      }
      if (userOpEventCount > 0) {
        console.log(`      📊 UserOperationEvent ${userOpEventCount}개 처리됨`)
      }
    } catch (e) {
      // if we processed latest block, then "lastBlock" is set to one above, so the new geth 15.9 error can safely be ignored.
      if (!(e as Error).message.includes('invalid block range params')) {
        console.log(`      ❌ 이벤트 처리 중 오류: ${(e as Error).message}`)
        throw e
      } else {
        console.log(`      ⚠️  블록 범위 파라미터 오류 무시됨`)
      }
    }
    const mempoolCountAfter = this.mempoolManager.count()
    const removedCount = mempoolCountBefore - mempoolCountAfter
    if (removedCount > 0) {
      console.log(`      ✅ Mempool에서 ${removedCount}개 UserOperation 제거됨`)
    }
  }

  handleEvent (ev: UserOperationEventEvent | AccountDeployedEvent | SignatureAggregatorChangedEvent): void {
    switch (ev.event) {
      case 'UserOperationEvent':
        this.handleUserOperationEvent(ev as any)
        break
      case 'AccountDeployed':
        this.handleAccountDeployedEvent(ev as any)
        break
      case 'SignatureAggregatorForUserOperations':
        this.handleAggregatorChangedEvent(ev as any)
        break
    }
    this.lastBlock = ev.blockNumber + 1
  }

  handleAggregatorChangedEvent (ev: SignatureAggregatorChangedEvent): void {
    debug('handle ', ev.event, ev.args.aggregator)
    this.eventAggregator = ev.args.aggregator
    this.eventAggregatorTxHash = ev.transactionHash
  }

  eventAggregator: string | null = null
  eventAggregatorTxHash: string | null = null

  // aggregator event is sent once per events bundle for all UserOperationEvents in this bundle.
  // it is not sent at all if the transaction is handleOps
  getEventAggregator (ev: TypedEvent): string | null {
    if (ev.transactionHash !== this.eventAggregatorTxHash) {
      this.eventAggregator = null
      this.eventAggregatorTxHash = ev.transactionHash
    }
    return this.eventAggregator
  }

  // AccountDeployed event is sent before each UserOperationEvent that deploys a contract.
  handleAccountDeployedEvent (ev: AccountDeployedEvent): void {
    this._includedAddress(ev.args.factory)
  }

  handleUserOperationEvent (ev: UserOperationEventEvent): void {
    const hash = ev.args.userOpHash
    console.log(`        🗑️  UserOperationEvent 처리: hash=${hash.substring(0, 20)}..., sender=${ev.args.sender}, block=${ev.blockNumber}`)
    this.mempoolManager.removeUserOp(hash)
    this._includedAddress(ev.args.sender)
    this._includedAddress(ev.args.paymaster)
    this._includedAddress(this.getEventAggregator(ev))
  }

  _includedAddress (data: string | null): void {
    if (data != null && data.length >= 42) {
      const addr = data.slice(0, 42)
      this.reputationManager.updateIncludedStatus(addr)
    }
  }
}
