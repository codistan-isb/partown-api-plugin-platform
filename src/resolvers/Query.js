import userLineChart from "../util/userLineChart.js";
import decodeOpaqueId from "@reactioncommerce/api-utils/decodeOpaqueId.js";
import getPaginatedResponse from "@reactioncommerce/api-utils/graphql/getPaginatedResponse.js";
import wasFieldRequested from "@reactioncommerce/api-utils/graphql/wasFieldRequested.js";
import ReactionError from "@reactioncommerce/reaction-error";
import totalInvestedAmount from "../util/totalInvestedAmount.js";

const calculateTotalRevenue = (transactions) => {
  return transactions.reduce((total, transaction) => {
    return (
      total +
      (transaction?.serviceCharges?.total
        ? transaction?.serviceCharges?.total
        : 0)
    );
  }, 0);
};

const calculateRevenueChange = (
  currentWeekTransactions,
  previousWeekTransactions
) => {
  const currentWeekRevenue = calculateTotalRevenue(currentWeekTransactions);
  const previousWeekRevenue = calculateTotalRevenue(previousWeekTransactions);
  console.log("current week", currentWeekRevenue);
  console.log("previous week", previousWeekRevenue);

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
    monthlyRevenue[transactionMonth] += transaction?.serviceCharges?.total
      ? transaction?.serviceCharges?.total
      : 0;
  });
  return monthlyRevenue;
};

const getMonthlyTrades = (trades) => {
  const monthlyTrades = {};

  trades.forEach((trade) => {
    const tradeMonth = new Date(trade?.createdAt).getMonth();

    if (monthlyTrades[tradeMonth]) {
      monthlyTrades[tradeMonth]++;
    } else {
      monthlyTrades[tradeMonth] = 1;
    }
  });

  const result = Array.from({ length: 12 }, (_, i) => monthlyTrades[i] || 0);
  return result;
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
        "product.isVisible": { $ne: false },
      });
      const countPrimary = await Catalog.countDocuments({
        "product.propertySaleType.type": "Primary",
        "product.isVisible": { $ne: false },
      });
      const countPremarket = await Catalog.countDocuments({
        "product.propertySaleType.type": "Premarket",
        "product.isVisible": { $ne: false },
      });

      const buyTradesCount = await Trades.aggregate([
        { $match: { tradeType: "offer" } },
        { $group: { _id: "$productId", count: { $sum: 1 } } },
        { $group: { _id: null, totalCount: { $sum: 1 } } },
      ]).toArray();

      const sellTradesCount = await Trades.aggregate([
        { $match: { tradeType: "bid" } },
        { $group: { _id: "$productId", count: { $sum: 1 } } },
        { $group: { _id: null, totalCount: { $sum: 1 } } },
      ]).toArray();

      console.log("buy count trades", buyTradesCount);
      console.log("sell trades count ", sellTradesCount);

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

      const trades = await Trades.find().toArray();

      const monthlyTrend = getMonthlyTrades(trades); // An array of trade counts for each month

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
          buy: buyTradesCount[0]?.totalCount
            ? buyTradesCount[0]?.totalCount
            : 0,
          sell: sellTradesCount[0]?.totalCost
            ? sellTradesCount[0]?.totalCost
            : 0,
          monthlyTrend,
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
      const { authToken, userId, collections } = context;
      const { Trades, Transactions, Catalog, Ownership, Dividends } =
        collections;

      console.log("userId for check", userId);

      if (!authToken || !userId)
        throw new ReactionError("access-denied", "Unauthorized");

      //amount Invested
      // const {
      //   totalInvestedValue: investedValue,
      //   currentValue,
      //   unrealisedCapitalGain,
      //   monthlyTotalInvestedValue,
      //   monthlyCurrentValue,
      // } = await totalInvestedAmount(context, userId);

      // console.log({
      //   totalInvestedValue: investedValue,
      //   currentValue,
      //   unrealisedCapitalGain,
      //   monthlyTotalInvestedValue,
      //   monthlyCurrentValue,
      // });

      const {
        totalInvestedValue : investedValue,
        currentValue,
        unrealisedCapitalGain,
        monthlyTotalInvestedValue,
        monthlyCurrentValue,
      } = await totalInvestedAmount(context, userId);

      const totalPerformance = unrealisedCapitalGain;

      //dividends
      const [dividendsReceived] = await Dividends.aggregate([
        {
          $match: { dividendsTo: userId },
        },
        {
          $group: {
            _id: null,
            dividendsReceived: {
              $sum: "$amount",
            },
          },
        },
      ]).toArray();

      // unrealised capital gain:

      // const { currentValue, investedValue, totalPerformance } =
      //   await userLineChart(userId, collections);

      // const [unrealisedCapitalGain] = await Trades.aggregate([
      //   {
      //     $match: {
      //       createdBy: userId,
      //       completionStatus: { $ne: "completed" },
      //       tradeType: { $ne: "offer" },
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: null,
      //       unrealisedCapitalGain: {
      //         $sum: { $multiply: ["$price", "$area"] },
      //       },
      //     },
      //   },
      // ]).toArray();

      //realised capital gain

      const [realisedCapitalGain] = await Trades.aggregate([
        {
          $match: {
            createdBy: userId,
            completionStatus: "completed",
            tradeType: { $ne: "offer" },
          },
        },
        {
          $group: {
            _id: null,
            realisedCapitalGain: {
              $sum: { $multiply: ["$price", "$area"] },
            },
          },
        },
      ]).toArray();

      //total amount invested
      // const [totalInvestment] = await Trades.aggregate([
      //   {
      //     $match: {
      //       createdBy: userId,
      //       tradeType: { $ne: "bid" },
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: null,
      //       totalInvestment: {
      //         $sum: { $multiply: ["$price", "$area"] },
      //       },
      //     },
      //   },
      // ]).toArray();

      //total cost
      // const [totalCost] = await Transactions.aggregate([
      //   {
      //     $match: {
      //       transactionBy: userId,
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: null,
      //       totalCost: {
      //         $sum: "$amount",
      //       },
      //     },
      //   },
      // ]).toArray();

      const totalCost = 0;

      const totalTransactions = await Transactions.aggregate([
        {
          $match: {
            approvalStatus: "approved",
            transactionBy: userId,
            $or: [
              { transactionType: "deposit" },
              { transactionType: "withdraw" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalDeposits: {
              $sum: {
                $cond: [{ $eq: ["$transactionType", "deposit"] }, "$amount", 0],
              },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [
                  { $eq: ["$transactionType", "withdraw"] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]).toArray();

      // console.log("total transactions are ", totalTransactions);

      const [{ totalDeposits = 0, totalWithdrawals = 0 } = {}] =
        totalTransactions;

      let netContributions = {
        Deposits: totalDeposits,
        Withdrawals: totalWithdrawals,
        total: totalDeposits - totalWithdrawals,
      };

      let capitalGain = realisedCapitalGain
        ? realisedCapitalGain?.realisedCapitalGain
        : 0;
      let realisedPerformance =
        dividendsReceived?.dividendsReceived + capitalGain;
      console.log("capital gain", capitalGain);
      console.log("");

      return {
        unrealisedCapitalGain,
        realisedCapitalGain: realisedCapitalGain?.realisedCapitalGain
          ? realisedCapitalGain?.realisedCapitalGain
          : 0,
        amountInvested: investedValue,
        totalCost,
        netContributions,
        dividendsReceived: dividendsReceived?.dividendsReceived,
        investedValueArray: monthlyTotalInvestedValue,
        currentValueArray: monthlyCurrentValue,
        performance: totalPerformance,
        realisedPerformance,
      };
    } catch (err) {
      return err;
    }
  },
  async propertyPayments(parent, { filter }, context, info) {
    try {
      const { Transactions } = context.collections;
      const aggregateParams = [
        {
          $group: {
            _id: "$user_id",
            totalAmount: { $sum: "$amount" },
            totalFeesAmount: { $sum: "$serviceCharges.total" },
          },
        },
      ];
      if (filter === "month") {
        // Get the current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        // Add a $match stage to the pipeline to filter by month and year
        aggregateParams.unshift({
          $match: {
            $expr: {
              $and: [
                { $eq: [{ $month: "$createdAt" }, currentMonth] },
                { $eq: [{ $year: "$createdAt" }, currentYear] },
              ],
            },
          },
        });
      } else if (filter === "year") {
        // Get the current year
        const now = new Date();
        const currentYear = now.getFullYear();
        // Add a $match stage to the pipeline to filter by year
        aggregateParams.unshift({
          $match: {
            $expr: { $eq: [{ $year: "$createdAt" }, currentYear] },
          },
        });
      }
      const totalAmount = await Transactions.aggregate(
        aggregateParams
      ).toArray();
      return {
        totalPayments: totalAmount[0]?.totalAmount
          ? totalAmount[0]?.totalAmount
          : 0,
        platformFees: totalAmount[0]?.totalFeesAmount
          ? totalAmount[0]?.totalFeesAmount
          : 0,
      };
    } catch (err) {
      return new Error(err);
    }
  },
  async platformBankDetails(parent, args, context, info) {
    try {
      const { userId, authToken, collections } = context;
      const { BankInfo } = collections;

      return (({
        sortCode,
        accountNumber,
        accountName,
        paymentReferences,
      }) => ({ sortCode, accountNumber, accountName, paymentReferences }))(
        await BankInfo.findOne({ isPlatformInfo: true })
      );
    } catch (err) {
      return err;
    }
  },
  async userBanks(parent, args, context, info) {
    try {
      const { userId, authToken, collections } = context;
      if (!authToken || !userId)
        throw new ReactionError("access-denied", "Unauthorized");

      const { searchQuery, ...connectionArgs } = args;
      const { BankInfo } = collections;

      let userBanks = await BankInfo.find({ accountId: userId });
      return getPaginatedResponse(userBanks, connectionArgs, {
        includeHasNextPage: wasFieldRequested("pageInfo.hasNextPage", info),
        includeHasPreviousPage: wasFieldRequested(
          "pageInfo.hasPreviousPage",
          info
        ),
        includeTotalCount: wasFieldRequested("totalCount", info),
      });
    } catch (err) {
      return err;
    }
  },
};
