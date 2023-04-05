export default {
  async createProductRate(parent, args, context, info) {
    try {
      let { sellerFee, buyerFee, productType } = args.input;

      let { ProductRate } = context.collections;

      let { auth, authToken, userId } = context;

      if (!authToken || !userId) return new Error("Unauthorized");

      const oldRates = await ProductRate.findOne({
        productType,
      });

      let newBuyerFee = !buyerFee ? oldRates?.buyerFee : buyerFee;
      let newSellerFee = !sellerFee ? oldRates?.sellerFee : sellerFee;

      const filter = {
        productType,
      };
      const update = {
        $set: {
          sellerFee: newSellerFee,
          buyerFee: newBuyerFee,
        },
        $setOnInsert: {
          productType,
        },
      };

      // Check if buyerFee and sellerFee are not null, then include them in the update operation

      console.log("update is ", update);

      const options = { upsert: true, returnOriginal: false };
      const rate = await ProductRate.findOneAndUpdate(filter, update, options);

      if (rate) {
        console.log("Rate is ", rate);
        return true;
      }
      throw new Error("Error creating product Rate");
    } catch (err) {
      console.log(err);
      return err;
    }
  },
};
