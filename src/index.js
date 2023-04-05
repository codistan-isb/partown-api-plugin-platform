import { createRequire } from "module";

const require = createRequire(import.meta.url);
import importAsString from "@reactioncommerce/api-utils/importAsString.js";
import SimpleSchema from "simpl-schema";
const mySchema = importAsString("./schema.graphql");
const pkg = require("../package.json");
import Mutation from "./resolvers/Mutation.js";
import Query from "./resolvers/Query.js";

/**
 * @summary Import and call this function to add this plugin to your API.
 * @param {Object} app The ReactionAPI instance
 * @returns {undefined}
 */

const resolvers = {
  Mutation,
  Query,
};

export default async function register(app) {
  await app.registerPlugin({
    label: pkg.label,
    name: "productrate",
    version: pkg.version,
    collections: {
      ProductRate: {
        name: "ProductRate",
        updatedAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
      },
    },
    graphQL: {
      schemas: [mySchema],
      resolvers,
    },
  });
}
