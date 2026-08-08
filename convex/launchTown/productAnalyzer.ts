'use node';

import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { ClaudeProductModelAnalyzer } from '../../launch-town-browser/src/productModelAnalyzer';

export const analyzeProduct = internalAction({
  args: { productId: v.id('products'), url: v.string() },
  handler: async (ctx, args) => {
    const productModel = await new ClaudeProductModelAnalyzer().analyze(args.url);
    await ctx.runMutation(internal.launchTown.productModel.saveProductModel, {
      productId: args.productId,
      ...productModel,
    });
    return productModel;
  },
});
