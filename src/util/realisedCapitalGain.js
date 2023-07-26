// Total_buying_price = user.property.average_buy_price*user.property.unit_being_sold
// Total_selling_price = user.offerx.sell_price*user.offerx.quantity
// user_capital_gains += Total_selling_price - Total_buying_price

//ownership.amount for each user owned property * current sell price for that property

// sell trade's amount/price * quantity

//capital gains

async function calculateTotalPrice(userId, Transactions, tradeType) {
  let userTradeTransactions = await Transactions.find({
    transactionBy: userId,
    tradeTransactionType: tradeType,
  }).toArray();

  console.log("user transactions are ", userTradeTransactions);

  let [initialSum] = userTradeTransactions.map((item) => {
    let sum = 0;
    let unitsSum = 0;
    sum += item?.amount;
    unitsSum += item?.unitsQuantity;
    return { sum: sum ? sum : 0, unitsSum: unitsSum ? unitsSum : 0 };
  });

  console.log("initial sum is ", initialSum);

  let avgSum = initialSum?.sum / userTradeTransactions.length;

  console.log("avg sum is ", avgSum);

  return avgSum * initialSum?.unitsSum;
}

export default async function realisedGain(context, userId) {
  const { Ownership, Trades, Transactions, Catalog } = context.collections;
  //   userId = "643e3e7f5f9ca8dca297854b";
  //   const [{ _id: productId }] = await Ownership.find({
  //     ownerId: userId,
  //   }).toArray();

  //amount units quantity
  const totalBuyPrice = await calculateTotalPrice(userId, Transactions, "buy");

  const totalSellPrice = await calculateTotalPrice(
    userId,
    Transactions,
    "sell"
  );

  console.log({ totalBuyPrice, totalSellPrice });

  return totalSellPrice - totalBuyPrice;

  //   loop price and add all prices

  //   let avg = priceSum/price.length
  //   let unitAvg  = unitsSum

  //   totalBuying = avg + unitAvg

  //   let { price, unit } = await Transactions.find({
  //     transactionBy: userId,

  //     tradeType: "sell",
  //   }).toArray()
  //   loop price and add all prices

  //   let avg = priceSum/price.length
  //   let unitAvg  = unitsSum

  //   totalBuying = avg + unitAvg
}
