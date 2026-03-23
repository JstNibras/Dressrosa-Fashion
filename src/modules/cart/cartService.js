const Cart = require('./cartModel');

exports.getCartData = async (userId) => {
    try {
        let cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            match: { isActive: true },
            populate: { path: 'category', match: { isActive: true }}
        });

        if (!cart) {
            return { items: [], cartTotal: 0, isCheckoutValid: false };
        }

        const validItems = cart.items.filter(item => item.product && item.product.category);

        let cartTotal = 0;
        let isCheckoutValid = validItems.length > 0;

        const processedItems = validItems.map(item => {
            const product = item.product;

            const variant = product.variants.find(v => 
                String(v.size).trim().toLowerCase() === String(item.size).trim().toLowerCase() && 
                v.isActive !== false 
            );
            const liveStock = variant ? variant.stock : 0;

            const isOutOfStock = liveStock === 0;
            const hasStockIssue = item.quantity > liveStock;
            
            const effectiveQty = Math.min(item.quantity, liveStock, 5);
            const itemTotal = effectiveQty * product.salePrice;

            if (!isOutOfStock) {
                cartTotal += itemTotal;
            } else {
                isCheckoutValid = false
            }

            return {
                _id: item._id,
                productId: product._id,
                name: product.name,
                categoryName: product.category.name,
                image: product.images[0],
                size: item.size,
                price: product.salePrice,
                regularPrice: product.regularPrice,
                quantity: item.quantity,
                liveStock: liveStock,
                isOutOfStock: isOutOfStock,
                hasStockIssue: hasStockIssue,
                availableSizes: product.variants.filter(v => v.isActive !== false)
            };
        });

        return {
            items: processedItems,
            cartTotal: cartTotal,
            isCheckoutValid: isCheckoutValid
        };

    } catch (error) {
        console.error("Cart Service Error:", error);
        throw error;
    }
}