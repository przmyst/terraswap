## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
    - [Update .env File](#update-env-file)
- [Get Token Price](#get-token-price)
- [Create a Terra Swap Pool](#create-a-terra-swap-pool)
    - [Create Pair](#create-pair)
    - [Add Pool Address](#add-pool-address)
- [Liquidity Operations](#liquidity-operations)
    - [Increase Allowance](#increase-allowance)
    - [Add Liquidity](#add-liquidity)
- [Token Swap](#token-swap)

---

## Installation

To install the required packages, run the following command:

```bash
npm install
```

## Configuration

### Update .env File

1. **Add Token Address**
2. **Add Mnemonic**
3. **Set Token Amount**
4. **Set Native Amount**
5. **Set Native Denom: uluna | uusd**

## Get Token Price

To get the token price, run:

```bash
node index get-native <Tokens-in> <Target-Price>
```

**Example:**

```bash
node index get-native 100000 0.00001
```

## Create a Terra Swap Pool

### Create Pair

Run the following command to create a pair:

```bash
node index create-pair
```

### Add Pool Address

Update the `.env` file to include the newly created pool address.

## Liquidity Operations

### Increase Allowance

To increase the token allowance, execute:

```bash
node index increase-allowance
```

### Add Liquidity

Add liquidity to the pool by running:

```bash
node index add-liquidity
```

### Remove Liquidity

Update the `.env` file to include the newly created LP token address.

Remove liquidity from the pool by running:

```bash
node index remove-liquidity
```

## Native Swap

To swap native currency for tokens, use:

```bash
node index swap-native <Amount> <Spread>
```

**Example:**

```bash
node index swap-native 100 0.1
```

## Token Swap

To swap tokens for native currency, use:

```bash
node index swap-token <Amount> <Spread>
```

**Example:**

```bash
node index swap-token 100 0.1
```