# test 1
- 최소 컨트랙트 + 번들러 포함

## 1. Running local node
```
docker run --rm -ti --name geth -p 127.0.0.1:8545:8545 ethereum/client-go:latest --miner.gaslimit 12000000 --http --http.api admin,debug,web3,eth,txpool,miner,net --http.vhosts '*,localhost,host.docker.internal,*.marblex.io' --http.addr "0.0.0.0" --http.corsdomain 'https://*.marblex.io,http://localhost:3000' --allow-insecure-unlock --rpc.allow-unprotected-txs --dev --verbosity 3 --nodiscover --maxpeers 0 --mine --networkid 1337
```

## 2. setting bundler 
1. run `yarn && yarn preprocess`
2. deploy contracts with `yarn hardhat-deploy --network localhost`
3. run `yarn run bundler`
    (or `yarn run bundler --unsafe`)

## 3. send user OP
 `yarn run runop --deployFactory --network http://localhost:8545/ --entryPoint 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`

# test 2
- test 1 + payMaster 포함

## 1. Running local node
```
docker run --rm -ti --name geth -p 127.0.0.1:8545:8545 ethereum/client-go:latest --miner.gaslimit 12000000 --http --http.api admin,debug,web3,eth,txpool,miner,net --http.vhosts '*,localhost,host.docker.internal,*.marblex.io' --http.addr "0.0.0.0" --http.corsdomain 'https://*.marblex.io,http://localhost:3000' --allow-insecure-unlock --rpc.allow-unprotected-txs --dev --verbosity 3 --nodiscover --maxpeers 0 --mine --networkid 1337
```

## 2. setting bundler 
1. run `yarn && yarn preprocess`
2. deploy contracts with `yarn hardhat-deploy --network localhost`
   - EntryPoint, SimpleAccountFactory, **DummyPaymaster** 배포됨
   - Paymaster에 1 ETH deposit 자동 추가
3. run `yarn run bundler --unsafe`

## 3. send user OP with Paymaster (gasless)
```bash
yarn run runop --deployFactory --network http://localhost:8545/ --entryPoint 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108 --paymaster <PAYMASTER_ADDRESS>
```

**참고**: `<PAYMASTER_ADDRESS>`는 `yarn hardhat-deploy` 실행 시 출력되는 DummyPaymaster 주소로 대체

### Paymaster 수동 배포 (필요시)
```bash
# 루트 디렉토리에서
yarn deploy-paymaster
```

### Paymaster deposit 추가 (필요시)
```javascript
// hardhat console에서
const paymaster = await ethers.getContractAt('DummyPaymaster', '<PAYMASTER_ADDRESS>')
await paymaster.deposit({ value: ethers.utils.parseEther('1') })
```

# test 3
- test 2 + RIP 7560 포함

# test 4
- test 3 + ERC 7702 포함
