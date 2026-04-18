const Cart = require('../models/cartModel');

exports.getCartData = async (userId) => {
    try {
        let cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            populate: { path: 'category' }
        });

        if (!cart) {
            return { items: [], cartTotal: 0, isCheckoutValid: false };
        }

        const processedItems = cart.items.map(item => {
            const product = item.product;

            // Handle deleted products
            if (!product) {
                return {
                    _id: item._id,
                    isDeleted: true,
                    isUnavailable: true,
                    name: "Removed Product",
                    price: 0,
                    quantity: item.quantity
                };
            }

            const variant = product.variants.find(v => 
                String(v.size).trim().toLowerCase() === String(item.size).trim().toLowerCase() && 
                v.isActive !== false 
            );
            const liveStock = variant ? variant.stock : 0;

            const isBlocked = !product.isActive || (product.category && !product.category.isActive);
            const isOutOfStock = liveStock === 0;
            const hasStockIssue = item.quantity > liveStock;
            const isUnavailable = isBlocked || isOutOfStock;
            
            return {
                _id: item._id,
                productId: product._id,
                name: product.name,
                categoryName: product.category ? product.category.name : 'Unknown',
                image: product.images[0],
                size: item.size,
                price: product.salePrice,
                regularPrice: product.regularPrice,
                quantity: item.quantity,
                liveStock: liveStock,
                isOutOfStock: isOutOfStock,
                isBlocked: isBlocked,
                isUnavailable: isUnavailable,
                hasStockIssue: hasStockIssue,
                availableSizes: product.variants.filter(v => v.isActive !== false)
            };
        });

        let cartTotal = 0;
        let regularTotal = 0;
        let isCheckoutValid = processedItems.length > 0;

        processedItems.forEach(item => {
            if (!item.isUnavailable && !item.isDeleted) {
                cartTotal += (item.quantity * item.price);
                regularTotal += (item.quantity * (item.regularPrice || item.price));
            } else {
                isCheckoutValid = false;
            }
        });

        return {
            items: processedItems,
            cartTotal: cartTotal,
            regularTotal: regularTotal,
            productDiscount: regularTotal - cartTotal,
            isCheckoutValid: isCheckoutValid
        };

    } catch (error) {
        console.error("Cart Service Error:", error);
        throw error;
    }
}