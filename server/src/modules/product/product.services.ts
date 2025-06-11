/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from 'mongoose';
import sortAndPaginatePipeline from '../../lib/sortAndPaginate.pipeline';
import BaseServices from '../baseServices';
import Product from './product.model';
import matchStagePipeline from './product.aggregation.pipeline';
import CustomError from '../../errors/customError';
import Purchase from '../purchase/purchase.model';
import Seller from '../seller/seller.model';
import { IProduct } from './product.interface';

class ProductServices extends BaseServices<any> {
  constructor(model: any, modelName: string) {
    super(model, modelName);
  }

  /**
   * Create new product
   */
  async create(payload: IProduct, userId: string) {
    type str = keyof IProduct;
    (Object.keys(payload) as str[]).forEach((key: str) => {
      if (payload[key] === '') {
        delete payload[key];
      }
    });

    payload.user = new Types.ObjectId(userId);

    try {
      const seller = await Seller.findById(payload.seller);
      const product = await this.model.create(payload);

      await Purchase.create([
        {
          user: userId,
          seller: product.seller,
          product: product._id,
          sellerName: seller?.name,
          productName: product.name,
          quantity: product.stock,
          unitPrice: product.price,
          totalPrice: product.stock * product.price
        }
      ]);

      return product;
    } catch (error) {
      console.log(error);
      throw new CustomError(400, 'Product create failed');
    }
  }

  /**
   * Count Total Product
   */
  async countTotalProduct(userId: string) {
    return this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$stock' }
        }
      },
      {
        $project: {
          totalQuantity: 1,
          _id: 0
        }
      }
    ]);
  }

  /**
   * Get All product of user
   */
  async readAll(query: Record<string, unknown> = {}, userId: string) {
    let data = await this.model.aggregate([...matchStagePipeline(query, userId), ...sortAndPaginatePipeline(query)]);

    const totalCount = await this.model.aggregate([
      ...matchStagePipeline(query, userId),
      {
        $group: {
          _id: null,
          total: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0
        }
      }
    ]);

    data = await this.model.populate(data, { path: 'category', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'brand', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'seller', select: '-__v -user -createdAt -updatedAt' });

    return { data, totalCount };
  }

  /**
   * Get Single product of user
   */
  async read(id: string, userId: string) {
    await this._isExists(id);
    return this.model.findOne({ user: new Types.ObjectId(userId), _id: id });
  }

  /**
   * Multiple delete
   */
  async bulkDelete(payload: string[]) {
    const data = payload.map((item) => new Types.ObjectId(item));

    return this.model.deleteMany({ _id: { $in: data } });
  }

  /**
   * Create new product
   */
  async addToStock(id: string, payload: Pick<IProduct, 'seller' | 'stock'>, userId: string) {
    // The original code used a database transaction, which is not supported by a standalone
    // MongoDB instance. The transaction has been removed to allow the feature to work in a
    // local development environment.

    // A bug in the original code was also fixed: The purchase record was being created
    // with the total stock instead of the added stock. This has been corrected.

    // Find the product to ensure it exists and to get its details.
    const product: any = await this.model.findById(id);
    if (!product) {
      throw new CustomError(404, 'Product not found');
    }

    // Find the seller to get their name for the purchase record.
    const seller = await Seller.findById(payload.seller);

    // Atomically increment the product's stock.
    await this.model.findByIdAndUpdate(id, { $inc: { stock: payload.stock } });

    // Create a purchase record for this stock addition.
    await Purchase.create([
      {
        user: userId,
        seller: payload.seller,
        product: product._id,
        sellerName: seller?.name,
        productName: product.name,
        quantity: Number(payload.stock),
        unitPrice: Number(product.price),
        totalPrice: Number(payload.stock) * Number(product.price)
      }
    ]);

    // The original function returned the product state *before* the update.
    // We will maintain this behavior by returning the product object we fetched initially.
    return product;
  }
}

const productServices = new ProductServices(Product, 'Product');
export default productServices;
