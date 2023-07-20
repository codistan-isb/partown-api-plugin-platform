// export default async function totalInvestedAmount(context, userId) {
//   const { Catalog, Transactions } = context.collections;

//   const userTransactions = await Transactions.find({
//     transactionType: null,
//     tradeTransactionType: "buy",
//     transactionBy: userId,
//   }).toArray();

//   let totalInvestedValue = 0;
//   for (const transaction of userTransactions) {
//     const propertyPriceWhenBought =
//       transaction.amount / transaction.unitsQuantity;

//     const unitsBought = transaction.unitsQuantity;
//     totalInvestedValue += propertyPriceWhenBought * unitsBought;
//   }

//   const propertyIds = userTransactions.map(
//     (transaction) => transaction.productId
//   );
//   const propertyPricesObj = {};

//   const propertyPrices = await Catalog.aggregate([
//     { $match: { "product._id": { $in: propertyIds } } },
//     { $project: { _id: "$product._id", latestPrice: "$product.area.price" } },
//   ]).toArray();

//   for (const price of propertyPrices) {
//     const propertyId = price._id;
//     const latestPrice = price.latestPrice;
//     propertyPricesObj[propertyId] = latestPrice;
//   }

//   let currentValue = 0;
//   for (const transaction of userTransactions) {
//     const propertyId = transaction.productId;

//     const unitsBought = transaction.unitsQuantity;

//     const propertyPrice = propertyPricesObj[propertyId];
//     if (propertyPrice !== undefined) {
//       currentValue += propertyPrice * unitsBought;
//     }
//   }

//   let unrealisedCapitalGain = currentValue - totalInvestedValue;

//   return { totalInvestedValue, currentValue, unrealisedCapitalGain };
// }

export default async function totalInvestedAmount(context, userId) {
  const { Catalog, Transactions } = context.collections;

  //subtract the sold amount from the bought amount
  const userTransactions = await Transactions.find({
    transactionType: null,
    tradeTransactionType: "buy",
    transactionBy: userId,
  }).toArray();

  //to add a check that verifies the owned amount

  let totalInvestedValue = 0;
  let monthlyTotalInvestedValue = Array(12).fill(0); // Monthly trend array for total invested value

  for (const transaction of userTransactions) {
    const propertyPriceWhenBought =
      transaction.amount / transaction.unitsQuantity;
    const unitsBought = transaction.unitsQuantity;

    const transactionMonth = transaction.createdAt.getMonth(); // Extract the month from createdAt field

    totalInvestedValue += propertyPriceWhenBought * unitsBought;
    monthlyTotalInvestedValue[transactionMonth] +=
      propertyPriceWhenBought * unitsBought;
  }

  // gives us the products against which transactions are made
  const propertyIds = userTransactions.map(
    (transaction) => transaction.productId
  );

  const propertyPricesObj = {};

  const propertyPrices = await Catalog.aggregate([
    { $match: { "product._id": { $in: propertyIds } } },
    {
      $project: {
        _id: "$product._id",
        latestPrice: "$product.area.price",
        createdAt: "$product.createdAt",
      },
    },
  ]).toArray();

  for (const price of propertyPrices) {
    const propertyId = price._id;
    const latestPrice = price.latestPrice;
    const propertyMonth = price.createdAt.getMonth(); // Extract the month from createdAt field

    propertyPricesObj[propertyId] = {
      price: latestPrice,
      month: propertyMonth,
    };
  }

  let currentValue = 0;
  let monthlyCurrentValue = Array(12).fill(0); // Monthly trend array for current value

  for (const transaction of userTransactions) {
    const propertyId = transaction.productId;
    const userUnits = transaction.unitsQuantity;
    const propertyPrice = propertyPricesObj[propertyId]?.price;
    const transactionMonth = transaction.createdAt.getMonth(); // Extract the month from createdAt field

    if (propertyPrice !== undefined) {
      currentValue += propertyPrice * userUnits;
      monthlyCurrentValue[transactionMonth] += propertyPrice * userUnits;
    }
  }

  let unrealisedCapitalGain = currentValue - totalInvestedValue;

  return {
    totalInvestedValue,
    currentValue,
    unrealisedCapitalGain,
    monthlyTotalInvestedValue,
    monthlyCurrentValue,
  };
}
