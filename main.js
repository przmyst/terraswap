#!/usr/bin/env node
import cli from 'cli'

import {Coins, LCDClient, MnemonicKey, MsgExecuteContract} from '@terra-money/terra.js'
import axios from 'axios'
import {delayP} from 'ramda-adjunct'
import {parseUnits, formatUnits} from "ethers";
import BigNumber from 'bignumber.js'

async function getLUNCPrice() {
    let result = await axios('https://api.coinmarketcap.com/data-api/v3/cryptocurrency/market-pairs/latest?slug=terra-luna&start=1&limit=10&category=spot&centerType=all&sort=cmc_rank_advanced&direction=desc&spotUntracked=true')
    return result.data.data.marketPairs[0].price
}

function calculateInitialPriceOfToken(initialReserveOfTokenA, initialReserveOfTokenB, currentPriceOfTokenBInUSD) {
    const initialValueOfTokenBInUSD = initialReserveOfTokenB * currentPriceOfTokenBInUSD;

    return initialValueOfTokenBInUSD / initialReserveOfTokenA;
}

async function main() {
    const amountToken = parseUnits(process.env.AMOUNT_TOKEN, 6).toString()
    const amountNative = parseUnits(process.env.AMOUNT_NATIVE, 6).toString()

    if (cli.command === 'calculate-price') {
        let price = await getLUNCPrice()

        const initialPriceOfTokenAInUSD = calculateInitialPriceOfToken(amountNative, amountToken, price);

        console.log(`The initial USD price of Token is $${initialPriceOfTokenAInUSD}`);
        return
    }

    const mk = new MnemonicKey({
        mnemonic: process.env.MNEMONIC,
    })

    const lcd = new LCDClient({
        URL: 'https://terra-classic-lcd.publicnode.com',
        chainID: 'columbus-5',
        gasAdjustment: 10,
        gasPrices: {
            uluna: '50'
        },
        isClassic: true
    })


    const wallet = lcd.wallet(mk)

    if (cli.command === 'create-pool') {
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
                chainID: 'columbus-5'
            })

            const result = await lcd.tx.broadcastSync(tx, 'columbus-5')

            console.log('Pair created')
            console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)
            console.log('Waiting for transaction confirmation...')

            await delayP(12000)

            const txInfo = await lcd.tx.txInfo(result.txhash)
            let obj = JSON.parse(txInfo.raw_log)
            let pairAddress = obj[0].events[1].attributes[0].value

            console.log('Add pool address to .env file:')
            console.log(pairAddress)

        } catch (e) {
            if (e.data && e.data.message && e.data.message.includes('Pair already exists')) {
                console.log('Pair already exists')
            } else {
                console.log(e)
            }
        }
        return
    }

    if (cli.command === 'increase-allowance') {
        try {

            const increaseAllowance = new MsgExecuteContract(
                wallet.key.accAddress,
                process.env.TOKEN_ADDRESS,
                {
                    increase_allowance: {
                        spender: process.env.POOL_ADDRESS,
                        amount: amountToken,
                        expires: {
                            never: {}
                        }
                    }
                },
            )

            const tx = await wallet.createAndSignTx({
                msgs: [increaseAllowance],
                chainID: 'columbus-5'
            })

            const result = await lcd.tx.broadcastSync(tx, 'columbus-5')

            console.log('Allowance increased')
            console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)

        } catch (e) {
            console.log(e)
        }
        return
    }

    if (cli.command === 'add-liquidity') {
        try {
            const addLiquidity = new MsgExecuteContract(
                wallet.key.accAddress,
                process.env.POOL_ADDRESS,
                {
                    provide_liquidity: {
                        assets: [
                            {
                                info: {
                                    native_token: {
                                        denom: process.env.NATIVE_DENOM
                                    }
                                },
                                amount: amountNative
                            },
                            {
                                info: {
                                    token: {
                                        contract_addr: process.env.TOKEN_ADDRESS
                                    }
                                },
                                amount: amountToken
                            }
                        ],
                        deadline: Date.now() + 300000
                    }
                },
                new Coins({
                    [process.env.NATIVE_DENOM]: amountNative
                })
            )

            const tx = await wallet.createAndSignTx({
                msgs: [addLiquidity],
                chainID: 'columbus-5'
            })

            const result = await lcd.tx.broadcast(tx)
            console.log('Liquidity Added')
            console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)

        } catch (e) {
            if (e.data && e.data.message) {
                console.log(e.data.message)
            } else {
                console.log(e)
            }
        }
    }
}

main().catch(console.error)
