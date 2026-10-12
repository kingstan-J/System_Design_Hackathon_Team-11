import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { FlashSale } from '../models/FlashSale.js';

export async function getProducts(req, res, next) {
  try {
    const { category, search, activeOnly } = req.query;
    const filter = {};

    if (activeOnly !== 'false') {
      filter.isActive = true;
    }

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const products = await Product.find(filter).lean();

    // Augment with live inventory and active flash sales
    const productIds = products.map((p) => p._id);
    const [inventories, activeSales] = await Promise.all([
      Inventory.find({ productId: { $in: productIds } }).lean(),
      FlashSale.find({
        productId: { $in: productIds },
        status: { $in: ['SCHEDULED', 'ACTIVE'] },
        endTime: { $gte: new Date() },
      }).lean(),
    ]);

    const inventoryMap = new Map(inventories.map((inv) => [inv.productId.toString(), inv]));
    const saleMap = new Map(activeSales.map((sale) => [sale.productId.toString(), sale]));

    const enrichedProducts = products.map((product) => {
      const inv = inventoryMap.get(product._id.toString()) || {
        availableQuantity: 0,
        totalQuantity: 0,
        reservedQuantity: 0,
        soldQuantity: 0,
      };
      const flashSale = saleMap.get(product._id.toString()) || null;

      return {
        ...product,
        inventory: {
          available: inv.availableQuantity,
          total: inv.totalQuantity,
          reserved: inv.reservedQuantity,
          sold: inv.soldQuantity,
        },
        flashSale: flashSale ? {
          id: flashSale._id,
          name: flashSale.name,
          flashSalePrice: flashSale.flashSalePrice,
          startTime: flashSale.startTime,
          endTime: flashSale.endTime,
          status: new Date() >= new Date(flashSale.startTime) && new Date() <= new Date(flashSale.endTime) ? 'ACTIVE' : 'SCHEDULED',
        } : null,
      };
    });

    res.status(200).json({
      count: enrichedProducts.length,
      products: enrichedProducts,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Product not found.',
      });
    }

    const [inv, flashSale] = await Promise.all([
      Inventory.findOne({ productId: product._id }).lean(),
      FlashSale.findOne({
        productId: product._id,
        status: { $in: ['SCHEDULED', 'ACTIVE'] },
        endTime: { $gte: new Date() },
      }).lean(),
    ]);

    res.status(200).json({
      product: {
        ...product,
        inventory: inv ? {
          available: inv.availableQuantity,
          total: inv.totalQuantity,
          reserved: inv.reservedQuantity,
          sold: inv.soldQuantity,
        } : { available: 0, total: 0, reserved: 0, sold: 0 },
        flashSale: flashSale ? {
          id: flashSale._id,
          name: flashSale.name,
          flashSalePrice: flashSale.flashSalePrice,
          startTime: flashSale.startTime,
          endTime: flashSale.endTime,
          status: new Date() >= new Date(flashSale.startTime) && new Date() <= new Date(flashSale.endTime) ? 'ACTIVE' : 'SCHEDULED',
        } : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const { name, description, category, price, flashSalePrice, imageUrl, stock } = req.body;

    const product = await Product.create({
      name,
      description,
      category,
      price,
      flashSalePrice: flashSalePrice || null,
      imageUrl: imageUrl || '/images/products/placeholder.webp',
    });

    // Initialize Inventory record
    const inventory = await Inventory.create({
      productId: product._id,
      totalQuantity: stock,
      availableQuantity: stock,
      reservedQuantity: 0,
      soldQuantity: 0,
    });

    res.status(201).json({
      message: 'Product and inventory initialized successfully',
      product,
      inventory,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      product,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      message: 'Product deactivated successfully',
      product,
    });
  } catch (err) {
    next(err);
  }
}
