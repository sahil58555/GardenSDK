const {
  BitcoinNetwork,
  BitcoinWallet,
  BitcoinProvider,
  EVMWallet,
} = require("@catalogfi/wallets");
const {
  Orderbook,
  Chains,
  Assets,
  Actions,
  parseStatus,
  TESTNET_ORDERBOOK_API,
} = require("@gardenfi/orderbook");
const { GardenJS } = require("@gardenfi/core");
const { JsonRpcProvider, Wallet } = require("ethers");

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  const BTC_PRIVATE_KEY = await askQuestion(
    "Please enter Bitcoin testnet private key: "
  );
  const EVM_PRIVATE_KEY = await askQuestion(
    "Please enter Sepolia testnet private key: "
  );

  const provider = new BitcoinProvider(BitcoinNetwork.Regtest);
  const privateKey = BTC_PRIVATE_KEY;

  const bitcoinWallet = BitcoinWallet.fromPrivateKey(privateKey, provider);

  const evmProvider = new JsonRpcProvider("http://localhost:8545");
  const evmPrivateKey = EVM_PRIVATE_KEY;

  const signer = new Wallet(evmPrivateKey, evmProvider);
  const evmWallet = new EVMWallet(signer);

  let continueLoop = true;

  while (continueLoop) {
    const answer = await askQuestion(
      "\n-------Press-------\n1 for btc to wbtc \n2 for wbtc to btc \ny for exit: "
    );

    if (answer === "y") {
      continueLoop = false;
    } else if (answer == "1") {
      await btcToWBTC(bitcoinWallet, evmWallet, signer);
      console.log("Transaction successfully initiated !!");
      continueLoop = false;
    } else if (answer == "2") {
      await wbtcToBTC(bitcoinWallet, evmWallet, signer);
      console.log("Transaction successfully initiated !!");
      continueLoop = false;
    } else {
      console.log("Press wrong key Try Again !! \n");
    }
  }

  rl.close();
}

const btcToWBTC = async (bitcoinWallet, evmWallet, signer) => {
  const orderbook = await Orderbook.init({
    signer: signer,
  });
  const wallets = {
    [Chains.bitcoin_testnet]: bitcoinWallet,
    [Chains.ethereum_sepolia]: evmWallet,
  };

  const garden = new GardenJS(orderbook, wallets);

  const sendAmount = 0.0001 * 1e8;
  const receiveAmount = (1 - 0.3 / 100) * sendAmount;

  const orderId = await garden.swap(
    Assets.bitcoin_testnet.BTC,
    Assets.ethereum_sepolia.WBTC,
    sendAmount,
    receiveAmount
  );

  garden.subscribeOrders(await evmWallet.getAddress(), async (orders) => {
    const order = orders.filter((order) => order.ID === orderId)[0];
    if (!order) return;

    const action = parseStatus(order);

    if (
      action === Actions.UserCanInitiate ||
      action === Actions.UserCanRedeem
    ) {
      const swapper = garden.getSwap(order);
      const swapOutput = await swapper.next();
      console.log("Swapper Output: ", swapOutput);
      console.log(
        `Completed Action ${swapOutput.action} with transaction hash: ${swapOutput.output}`
      );
    }
  });
};

const wbtcToBTC = async (bitcoinWallet, evmWallet, signer) => {
  const orderbook = await Orderbook.init({
    url: TESTNET_ORDERBOOK_API,
    signer: signer,
  });
  const wallets = {
    [Chains.bitcoin_testnet]: bitcoinWallet,
    [Chains.ethereum_sepolia]: evmWallet,
  };

  const garden = new GardenJS(orderbook, wallets);

  const sendAmount = 0.0001 * 1e8;
  const receiveAmount = (1 - 0.3 / 100) * sendAmount;

  const orderId = await garden.swap(
    Assets.ethereum_sepolia.WBTC,
    Assets.bitcoin_testnet.BTC,
    sendAmount,
    receiveAmount
  );

  garden.subscribeOrders(await evmWallet.getAddress(), async (orders) => {
    const order = orders.filter((order) => order.ID === orderId)[0];
    if (!order) return;

    const action = parseStatus(order);

    if (
      action === Actions.UserCanInitiate ||
      action === Actions.UserCanRedeem
    ) {
      const swapper = garden.getSwap(order);
      const swapOutput = await swapper.next();
      console.log("Swapper Output: ", swapOutput);
      console.log(
        `Completed Action ${swapOutput.action} with transaction hash: ${swapOutput.output}`
      );
    }
  });
};

main();
