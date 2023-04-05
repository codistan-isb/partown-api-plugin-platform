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
};
