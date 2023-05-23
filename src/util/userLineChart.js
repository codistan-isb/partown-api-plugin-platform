function getCurrentPrice(priceHistory, transactionDate) {
  let currentPrice = 0;

  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const { price, date } = priceHistory[i];
    if (new Date(date) <= new Date(transactionDate)) {
      currentPrice = price;
      break;
    }
  }

  return currentPrice;
}

export default async function (userId, collections) {
  const { Catalog, Ownership, Transactions, Trades } = collections;

  const products = await Catalog.find({}).toArray();

  const transactions = await Transactions.find({
    transactionBy: userId,
    tradeTransactionType: { $exists: true, $ne: null },
  }).toArray();

  // Calculate current value and invested value for each month
  const currentValue = new Array(12).fill(0);
  const investedValue = new Array(12).fill(0);

  transactions.forEach((transaction) => {
    const { createdAt, amount, unitsQuantity, tradeTransactionType } =
      transaction;

    console.log([createdAt, amount, unitsQuantity, tradeTransactionType]);
    const transactionMonth = new Date(createdAt).getMonth();

    const product = products.find(
      (p) => p.product.productId === transaction.productId
    );
    if (!product) return;

    const { priceHistory } = product.product;

    console.log("pricing history is ", priceHistory);

    const transactionPrice = amount / unitsQuantity;

    console.log("transaction Price is ", transactionPrice);
    const currentPrice = getCurrentPrice(priceHistory, createdAt);

    if (tradeTransactionType === "buy") {
      if (transactionPrice > currentPrice) {
        investedValue[transactionMonth] -= transactionPrice * unitsQuantity;
      } else {
        investedValue[transactionMonth] += transactionPrice * unitsQuantity;
      }
    } else if (tradeTransactionType === "sell") {
      if (transactionPrice > currentPrice) {
        investedValue[transactionMonth] += transactionPrice * unitsQuantity;
      } else {
        investedValue[transactionMonth] -= transactionPrice * unitsQuantity;
      }
    }

    currentValue[transactionMonth] += currentPrice * unitsQuantity;
  });

  const performance = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    performance[i] = currentValue[i] - investedValue[i];
  }

  // Calculate total performance
  const totalPerformance = performance.reduce(
    (total, value) => total + value,
    0
  );
  //get the current price from priceHistory

  console.log("current value", currentValue);
  console.log("invested value", investedValue);

  console.log("total performance is ", totalPerformance);
  return { currentValue, investedValue, totalPerformance };
}
