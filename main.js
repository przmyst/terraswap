#!/usr/bin/env node
var cli = require('cli');

import {
    Coins, LCDClient, MnemonicKey, MsgExecuteContract, MsgInstantiateContract
} from '@terra-money/terra.js'
import axios from 'axios'
import {
    delayP
} from 'ramda-adjunct'
import BigNumber from 'bignumber.js';
import {parseUnits} from "ethers";

// Function to calculate spread
function calculateSpread(existingTokenReserve, existingNativeReserve, addTokenAmount, addNativeAmount) {
    const newTokenReserve = new BigNumber(existingTokenReserve).plus(addTokenAmount);
    const newNativeReserve = new BigNumber(existingNativeReserve).plus(addNativeAmount);

    return newTokenReserve.div(newNativeReserve).minus(existingTokenReserve.div(existingNativeReserve));
}

async function fetchPoolReserves(lcd, pairAddress) {
    try {
        const poolInfo = await lcd.wasm.contractQuery(pairAddress, {
            pool: {}
        });
        return {
            tokenReserve: new BigNumber(poolInfo.assets[0].amount),
            nativeReserve: new BigNumber(poolInfo.assets[1].amount)
        };
    } catch (e) {
        console.error('Error fetching pool reserves:', e);
        return null;
    }
}

async function getLUNCPrice() {
    let result = await axios('https://api.coinmarketcap.com/data-api/v3/cryptocurrency/market-pairs/latest?slug=terra-luna&start=1&limit=10&category=spot&centerType=all&sort=cmc_rank_advanced&direction=desc&spotUntracked=true')
    console.log(result.data)

    return result.data.data.marketPairs[0].price
}

// Function to calculate initial USD price of Token A
function calculateInitialPriceOfTokenA(initialReserveOfTokenA, initialReserveOfTokenB, currentPriceOfTokenBInUSD) {
    // Calculate the initial price ratio (Token A / Token B)
    const initialPriceRatio = initialReserveOfTokenA / initialReserveOfTokenB;

    // Calculate the total USD value of initial reserve of Token B
    const initialValueOfTokenBInUSD = initialReserveOfTokenB * currentPriceOfTokenBInUSD;

    // Calculate the initial USD price of Token A
    const initialPriceOfTokenAInUSD = initialValueOfTokenBInUSD / initialReserveOfTokenA;

    return initialPriceOfTokenAInUSD;
}


async function main() {
    if (cli.command === 'calculate-price') {
        let price = await getLUNCPrice()
        let nativeAmount = parseUnits(process.env.AMOUNT_NATIVE, 6).toString()
        let tokenAmount = parseUnits(process.env.AMOUNT_TOKEN, 6).toString()

        const initialPriceOfTokenAInUSD = calculateInitialPriceOfTokenA(nativeAmount, tokenAmount, price);

        console.log(`The initial USD price of Token is $${initialPriceOfTokenAInUSD}`);

        return
    }


    let pairAddress = process.env.POOL_ADDRESS || ''
    const chainID = 'columbus-5'

    const mk = new MnemonicKey({
        mnemonic: process.env.MNEMONIC,
    })

    let gasPrices = await axios('https://columbus-fcd.terra.dev/v1/txs/gas_prices')
    gasPrices = gasPrices.data
    gasPrices.uusd = '1'
    gasPrices.uluna = '50'
    // console.log(gasPrices)

    const lcd = new LCDClient({
        URL: 'https://lcd.terra.dev',
        chainID,
        gasAdjustment: 3,
        gasPrices
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
                chainID
            })

            const result = await lcd.tx.broadcastSync(tx, chainID)

            console.log('Pair created')
            console.log(`https://finder.terra.money/classic/tx/${result.txhash}`)

            await delayP(10000)

            const txInfo = await lcd.tx.txInfo(result.txhash)
            let obj = JSON.parse(txInfo.raw_log)
            pairAddress = obj[0].events[1].attributes[0].value
            console.log('Add pool address to .env file:')
            console.log(pairAddress)
        } catch (e) {
            if(e.data && e.data.message && e.data.message.includes('Pair already exists')){
                console.log('Pair already exists')
            }else{
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
        }
        return
    }

    if (cli.command === 'add-liquidity') {
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
                        ],
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


            if(!result.raw_log){
                console.log('Liquidity added')
                console.log(result.txhash)
            }else{
                console.log(result.raw_log)
            }


        } catch (e) {
            if(e.data && e.data.message){
                console.log(e.data.message)
            }else{
                console.log(e)
            }
        }
    }
}

main().catch(console.error)
