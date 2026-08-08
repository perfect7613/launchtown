import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

export const saveProductModel = internalMutation({
  args: {
    productId: v.id('products'),
    url: v.string(),
    category: v.string(),
    cta: v.string(),
    claims: v.array(v.string()),
    likelyConcerns: v.array(v.string()),
    conversionProxy: v.string(),
  },
  handler: async (ctx, args) => {
    const { productId, cta, ...model } = args;
    await ctx.db.patch(productId, {
      url: model.url,
      analysisStatus: 'complete',
      productModel: {
        category: model.category,
        primaryCta: cta,
        claims: model.claims,
        likelyConcerns: model.likelyConcerns,
        conversionProxy: model.conversionProxy,
      },
    });
  },
});
