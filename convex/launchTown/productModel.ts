import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { normalizePublicProductUrl } from './productInput';

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
      url: normalizePublicProductUrl(model.url),
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

export const markAnalysisFailed = internalMutation({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (product?.analysisStatus === 'running') {
      await ctx.db.patch(productId, { analysisStatus: 'failed' });
    }
  },
});
