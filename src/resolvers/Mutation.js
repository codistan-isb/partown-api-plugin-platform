import ObjectID from "mongodb";
import ReactionError from "@reactioncommerce/reaction-error";
export default {
  async createProductRate(parent, args, context, info) {
    try {
      let { sellerFee, buyerFee, productType } = args.input;

      if (sellerFee > 100 || buyerFee > 100) {
        return new Error("Platform fee cannot be greater than 100%");
      }

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
  async updateBankDetails(_, args, context, info) {
    try {
      const { userId, authToken, collections } = context;

      const { BankInfo, Accounts } = collections;

      const {
        sortCode,
        accountNumber,
        accountName,
        paymentReferences,
        isPlatformInfo,
        alias,
        bankName,
      } = args.input;

      const adminAccount = await Accounts.findOne({
        _id: userId,
      });

      if (
        (isPlatformInfo && !adminAccount?.adminUIShopIds?.length) ||
        adminAccount?.adminUIShopIds?.length < 0
      )
        return new Error("You are not permitted to perform this action");

      let response;

      if (isPlatformInfo) {
        // Check if there is an existing record with isPlatformInfo=true
        const existingRecord = await BankInfo.findOne({ isPlatformInfo: true });

        // Merge existing values with new values
        const mergedValues = {
          sortCode: sortCode || existingRecord.sortCode,
          accountNumber: accountNumber || existingRecord.accountNumber,
          accountName: accountName || existingRecord.accountName,
          paymentReferences:
            paymentReferences || existingRecord.paymentReferences,
          isPlatformInfo,
          accountId: userId,
          bankName,
        };

        if (existingRecord) {
          // Update the existing record
          response = await BankInfo.updateOne(
            { _id: existingRecord._id },
            { $set: mergedValues }
          );
        } else {
          // Insert a new record
          response = await BankInfo.insertOne(mergedValues);
        }
      } else {
        // Insert a new record with isPlatformInfo=false
        response = await BankInfo.insertOne({
          sortCode,
          accountNumber,
          accountName,
          paymentReferences,
          isPlatformInfo,
          alias,
          accountId: userId,
          bankName,
        });
      }

      return response?.result?.n > 0;
    } catch (err) {
      return err;
    }
  },
  async removeBank(_, { bankId }, context, info) {
    try {
      const { userId, authToken, collections } = context;

      if (!authToken || !userId)
        throw new ReactionError("access-denied", "Unauthorized");

      const { BankInfo } = collections;

      const { result } = await BankInfo.remove({
        _id: ObjectID.ObjectId(bankId),
        accountId: userId,
      });
      return result?.n > 0;
    } catch (err) {
      return err;
    }
  },
};
