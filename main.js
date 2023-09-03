import {
    Coins, LCDClient, MnemonicKey, MsgExecuteContract
} from '@terra-money/terra.js'
import axios from 'axios'
import {
    delayP
} from 'ramda-adjunct'

async function main() {

    let pairAddress = ''
    const chainID = 'columbus-5'

    const mk = new MnemonicKey({
        mnemonic: process.env.MNEMONIC,
    })

    let gasPrices = await axios('https://columbus-fcd.terra.dev/v1/txs/gas_prices')
    gasPrices = gasPrices.data

    const lcd = new LCDClient({
        URL: 'https://lcd.terra.dev',
        chainID,
        gasAdjustment: 2,
        gasPrices
    })

    const wallet = lcd.wallet(mk)

    try {
        const createPair = new MsgExecuteContract(
            wallet.key.accAddress,
            process.env.FACTORY_ADDRESS,
            {
                create_pair: {
                    assets: [
                        {
                            info: {
                                token: {
                                    contract_addr: process.env.TOKEN_ADDRESS
                                }
                            },
                            amount: '0'
                        },
                        {
                            info: {
                                native_token: {
                                    denom: process.env.NATIVE_DENOM
                                }
                            },
                            amount: '0'
                        }
                    ]
                }
            }
        )

        const tx = await wallet.createAndSignTx({
            msgs: [createPair],
            chainID
        })

        const result = await lcd.tx.broadcastSync(tx, chainID)

        console.log('Pair created')
        console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)

        await delayP(10000)

        const txInfo = await lcd.tx.txInfo(result.txhash)
        let obj = JSON.parse(txInfo.raw_log)
        pairAddress = obj[0].events[1].attributes[0].value

    } catch (e) {
        console.log(e)
    }

    try {

        const increaseAllowance = new MsgExecuteContract(
            wallet.key.accAddress,
            process.env.TOKEN_ADDRESS,
            {
                increase_allowance: {
                    spender: pairAddress,
                    amount: process.env.AMOUNT_TOKEN,
                    expires: {
                        never: {}
                    }
                }
            },
        )

        const tx = await wallet.createAndSignTx({
            msgs: [increaseAllowance],
            chainID
        })
        const result = await lcd.tx.broadcastSync(tx, chainID)

        console.log('Allowance increased')
        console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)

    } catch (e) {
        console.log(e)
    } finally {
        await delayP(10000)
    }

    try {
        const addLiquidity = new MsgExecuteContract(
            wallet.key.accAddress,
            pairAddress,
            {
                provide_liquidity: {
                    assets: [
                        {
                            info: {
                                native_token: {
                                    denom: process.env.NATIVE_DENOM
                                }
                            },
                            amount: process.env.AMOUNT_NATIVE
                        },
                        {
                            info: {
                                token: {
                                    contract_addr: process.env.TOKEN_ADDRESS
                                }
                            },
                            amount: process.env.AMOUNT_TOKEN
                        }
                    ]
                }
            },
            new Coins({
                [process.env.NATIVE_DENOM]: process.env.AMOUNT_NATIVE
            })
        )

        const tx = await wallet.createAndSignTx({
            msgs: [addLiquidity],
            chainID
        })

        const result = await lcd.tx.broadcastSync(tx, chainID)

        console.log('Liquidity added')
        console.log(result)

    } catch (e) {
        console.log(e)
    }
}

main().catch(console.error)
