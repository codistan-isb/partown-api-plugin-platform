import decodeOpaqueId from "@reactioncommerce/api-utils/decodeOpaqueId.js";

const calculateTotalRevenue = (transactions) => {
  return transactions.reduce((total, transaction) => {
    return total + transaction?.serviceCharges?.total;
  }, 0);
};

const calculateRevenueChange = (
  currentWeekTransactions,
  previousWeekTransactions
) => {
  const currentWeekRevenue = calculateTotalRevenue(currentWeekTransactions);
  const previousWeekRevenue = calculateTotalRevenue(previousWeekTransactions);
  const revenueChange = currentWeekRevenue - previousWeekRevenue;
  const revenueChangePercentage = previousWeekRevenue
    ? (revenueChange / previousWeekRevenue) * 100
    : 0;
  return {
    revenueChange,
    revenueChangePercentage,
  };
};
const calculateMonthlyRevenue = (transactions) => {
  const monthlyRevenue = new Array(12).fill(0);
  transactions.forEach((transaction) => {
    const transactionMonth = new Date(transaction.createdAt).getMonth();
    monthlyRevenue[transactionMonth] += transaction.serviceCharges.total;
  });
  return monthlyRevenue;
};

export default {
  async getPropertyRates(parent, args, context, info) {
    try {
      let { ProductRate } = context.collections;

      const { filter } = args;

      //let filter = { createdBy: byUser };

      const { buyerFee, sellerFee } = await ProductRate.findOne({
        productType: filter?.rateType,
      });

      if (filter?.rateValue === "seller" || filter?.rateValue === "Seller")
        return sellerFee;
      if (filter?.rateValue === "buyer" || filter?.rateValue === "Buyer")
        return buyerFee;
    } catch (err) {
      console.log("get product rate error ", err);
      return err;
    }
  },
  async adminDashboardStats(parent, args, context, info) {
    try {
      const { userId, authToken, collections } = context;
      const { Catalog, Trades, Transactions, Accounts } = collections;

      const countResale = await Catalog.countDocuments({
        "product.propertySaleType.type": "Resale",
      });
      const countPrimary = await Catalog.countDocuments({
        "product.propertySaleType.type": "Primary",
      });
      const countPremarket = await Catalog.countDocuments({
        "product.propertySaleType.type": "Premarket",
      });

      const buyTradesCount = await Trades.countDocuments({
        tradeType: "offer",
      });

      const sellTradesCount = await Trades.countDocuments({
        tradeType: "bid",
      });

      const usersCount = await Accounts.countDocuments();

      const totalAmount = await Transactions.aggregate([
        {
          $group: {
            _id: "$user_id",
            totalAmount: { $sum: "$amount" },
            totalFeesAmount: { $sum: "$serviceCharges.total" },
          },
        },
      ]).toArray();

      console.log("total payments are", totalAmount);

      const allData = {
        productCount: {
          premarket: countPremarket,
          primary: countPrimary,
          resale: countResale,
          total: countPremarket + countPrimary + countResale,
        },
        productPayments: {
          totalPayments: totalAmount[0]?.totalAmount,
          platformFees: totalAmount[0]?.totalFeesAmount,
        },

        totalTrades: {
          buy: buyTradesCount,
          sell: sellTradesCount,
        },
        totalUsers: {
          subscribed: 0,
          nonSubscribed: usersCount,
        },
        totalRevenue: 10,
      };
      return allData;
    } catch (err) {
      return err;
    }
  },
  async revenueStats(parent, { year }, context, info) {
    try {
      const { Transactions } = context.collections;

      //get current year date range
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      // Find all transactions in the given year
      const yearTransactions = await Transactions.find({
        createdAt: { $gte: startDate, $lte: endDate },
      }).toArray();

      // Total for year argument
      const totalRevenue = calculateTotalRevenue(yearTransactions);

      // For current and previous weeks
      const currentDate = new Date();
      const currentWeekStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - currentDate.getDay()
      );
      const currentWeekEnd = new Date(
        currentWeekStart.getFullYear(),
        currentWeekStart.getMonth(),
        currentWeekStart.getDate() + 6
      );
      const currentWeekTransactions = yearTransactions.filter((transaction) => {
        return (
          transaction.createdAt >= currentWeekStart &&
          transaction.createdAt <= currentWeekEnd
        );
      });
      const previousWeekStart = new Date(
        currentWeekStart.getFullYear(),
        currentWeekStart.getMonth(),
        currentWeekStart.getDate() - 7
      );
      const previousWeekEnd = new Date(
        previousWeekStart.getFullYear(),
        previousWeekStart.getMonth(),
        previousWeekStart.getDate() + 6
      );
      const previousWeekTransactions = yearTransactions.filter(
        (transaction) => {
          return (
            transaction.createdAt >= previousWeekStart &&
            transaction.createdAt <= previousWeekEnd
          );
        }
      );
      const { revenueChange, revenueChangePercentage } = calculateRevenueChange(
        currentWeekTransactions,
        previousWeekTransactions
      );

      // Monthly revenue for the year
      const monthlyRevenue = calculateMonthlyRevenue(yearTransactions);

      return {
        totalRevenue,
        revenueChange,
        revenueChangePercentage,
        monthlyRevenue,
      };
    } catch (err) {
      console.log("err", err);
      return err;
    }
  },
  async portfolio(parent, args, context, info) {
    try {
      const { userId, collections } = context;
      const { Trades, Transactions } = collections;

      // Get all the trades for the user
      const trades = await Trades.find({ createdBy: userId }).toArray();

      // Get all the transactions for the user
      const transactions = await Transactions.find({
        transactionBy: userId,
      }).toArray();

      let amountInvested = 0;
      let totalCost = 0;
      let unrealisedCapitalGain = 0;
      let dividendsReceived = 0;
      let realisedCapitalGain = 0;
      let portfolioValue = 0;
      let performance = [];

      let currentMonth = "";
      trades.forEach((trade) => {
        const month = new Date(trade.createdAt).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        if (month !== currentMonth) {
          // Add the portfolio value for the previous month to the performance data
          if (portfolioValue !== 0) {
            performance.push({ date: currentMonth, value: portfolioValue });
          }
          // Reset the portfolio value for the current month
          portfolioValue = 0;
          currentMonth = month;
        }
        const currentValue = trade.property.currentValue;
        portfolioValue +=
          trade?.tradeType === "offer" ? -trade?.price : trade?.price;
        if (trade?.tradeType === "offer") {
          amountInvested += trade?.price;
          totalCost += trade?.price;
          unrealisedCapitalGain -=
            (trade?.area * trade?.price) / trade?.originalQuantity -
            (trade?.area * currentValue) / trade?.originalQuantity;
        } else if (trade?.tradeType === "bid") {
          totalCost += trade?.price;
          realisedCapitalGain += trade?.price - trade.cost;
          portfolioValue += trade?.price - trade.cost;
        }
      });
      transactions.forEach((transaction) => {
        const month = new Date(transaction.createdAt).toLocaleString(
          "default",
          { month: "short", year: "numeric" }
        );
        if (month !== currentMonth) {
          // Add the portfolio value for the previous month to the performance data
          if (portfolioValue !== 0) {
            performance.push({ date: currentMonth, value: portfolioValue });
          }
          // Reset the portfolio value for the current month
          portfolioValue = 0;
          currentMonth = month;
        }
        if (transaction.type === "buy") {
          amountInvested += transaction.amount;
          totalCost += transaction.amount;
          const currentValue = transaction.property.currentValue;
          unrealisedCapitalGain -=
            (transaction.units * transaction.amount) / transaction.totalUnits -
            (transaction.units * currentValue) / transaction.totalUnits;
          portfolioValue -= transaction.units * currentValue;
        } else if (transaction.type === "sell") {
          totalCost += transaction.amount;
          realisedCapitalGain += transaction.amount - transaction.cost;
          portfolioValue += transaction.amount - transaction.cost;
        } else if (transaction.type === "dividend") {
          dividendsReceived += transaction.amount;
        }
      });
      // Add the portfolio value for the last month to the performance data
      if (portfolioValue !== 0) {
        performance.push({ date: currentMonth, value: portfolioValue });
      }
      // Calculate the current portfolio value
      const properties = trades.map((trade) => trade.property);
      let propertyValue = 0;
      properties.forEach((property) => {
        propertyValue += property.currentValue * property.units;
      });
      const portfolioCurrentValue = propertyValue + portfolioValue;

      return {
        amountInvested,
        totalCost,
        unrealisedCapitalGain,
        dividendsReceived,
        realisedCapitalGain,
        portfolioValue,
        portfolioCurrentValue,
        performance,
      };
    } catch (err) {
      return err;
    }
  },
};
