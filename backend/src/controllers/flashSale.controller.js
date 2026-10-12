import { FlashSale } from '../models/FlashSale.js';
import { Product } from '../models/Product.js';

export async function getFlashSales(req, res, next) {
  try {
    const flashSales = await FlashSale.find()
      .populate('productId', 'name description category price imageUrl isActive')
      .sort({ startTime: 1 })
      .lean();

    const formatted = flashSales.map((sale) => {
      const now = new Date();
      let liveStatus = sale.status;
      if (sale.status !== 'CANCELLED') {
        if (now < new Date(sale.startTime)) liveStatus = 'SCHEDULED';
        else if (now >= new Date(sale.startTime) && now <= new Date(sale.endTime)) liveStatus = 'ACTIVE';
        else liveStatus = 'ENDED';
      }

      return {
        ...sale,
        computedStatus: liveStatus,
      };
    });

    res.status(200).json({
      count: formatted.length,
      sales: formatted,
    });
  } catch (err) {
    next(err);
  }
}

export async function getFlashSaleById(req, res, next) {
  try {
    const sale = await FlashSale.findById(req.params.id)
      .populate('productId')
      .lean();

    if (!sale) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Flash sale not found.',
      });
    }

    const now = new Date();
    let liveStatus = sale.status;
    if (sale.status !== 'CANCELLED') {
      if (now < new Date(sale.startTime)) liveStatus = 'SCHEDULED';
      else if (now >= new Date(sale.startTime) && now <= new Date(sale.endTime)) liveStatus = 'ACTIVE';
      else liveStatus = 'ENDED';
    }

    res.status(200).json({
      sale: {
        ...sale,
        computedStatus: liveStatus,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createFlashSale(req, res, next) {
  try {
    const { name, productId, startTime, endTime, flashSalePrice, configuredStock } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Associated product does not exist.',
      });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'End time must be strictly after start time.',
      });
    }

    const flashSale = await FlashSale.create({
      name,
      productId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      flashSalePrice,
      configuredStock,
    });

    // Also update product's flashSalePrice field
    product.flashSalePrice = flashSalePrice;
    await product.save();

    res.status(201).json({
      message: 'Flash sale scheduled successfully',
      sale: flashSale,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateFlashSale(req, res, next) {
  try {
    const sale = await FlashSale.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!sale) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Flash sale not found.',
      });
    }

    res.status(200).json({
      message: 'Flash sale updated successfully',
      sale,
    });
  } catch (err) {
    next(err);
  }
}
