import decodeOpaqueId from "@reactioncommerce/api-utils/decodeOpaqueId.js";
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
};
