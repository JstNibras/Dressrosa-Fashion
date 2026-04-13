const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');

exports.placeOrder = async (userId, addressId, paymentMethod, appliedCoupon = null, buyNowItem = null) => {
    try {
        const addressDoc = await Address.findById(addressId);
        if (!addressDoc) throw new Error("Delivery address not found");

        let validItems = [];
        let cartDoc = null;

        if (buyNowItem) {
            const product = await Product.findById(buyNowItem.productId).populate('category');
            
            if (!product || product.isActive === false || product.isListed === false ||
                !product.category || product.category.isActive === false || product.category.isListed === false) {
                throw new Error("Transaction Failed: Product or category is unavailable.");
            }

            validItems = [{
                product: product, 
                size: buyNowItem.size,
                quantity: buyNowItem.quantity
            }];
        } else {
            cartDoc = await Cart.findOne({ user: userId }).populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

            if (!cartDoc || cartDoc.items.length === 0) throw new Error("Cart is empty");

            const pureCart = JSON.parse(JSON.stringify(cartDoc));
            validItems = pureCart.items.filter(item => {
                const p = item.product;
                if (!p) return false;
                const productActive = p.isActive !== false && p.isListed !== false;
                const categoryActive = p.category && p.category.isActive !== false && p.category.isListed !== false;
                return productActive && categoryActive;
            });

            if (validItems.length !== pureCart.items.length) {
                throw new Error("Transaction Failed: One or more items belong to a suspended category.");
            }
            if (validItems.length === 0) throw new Error("No valid items found in cart during checkout.");
        }

        let subtotal = 0;
        const orderItems = validItems.map(item => {
            const product = item.product;
            const variant = product.variants.find(v => 
                String(v.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
            );

            if (!variant || variant.stock < item.quantity) {
                throw new Error(`Transaction Failed: ${product.name} (Size: ${item.size}) only has ${variant ? variant.stock : 0} left in stock.`);
            }

            const itemTotal = item.quantity * product.salePrice;
            subtotal += itemTotal;

            let productImage = '/images/default-product.png'; 
            if (product.images && product.images.length > 0) {
                productImage = product.images[0];
            } else if (product.image && product.image.length > 0) {
                productImage = product.image[0]; 
            }

            return {
                productId: product._id,
                name: product.name,
                image: productImage,
                price: product.salePrice,
                size: item.size,
                quantity: item.quantity,
                itemTotal: itemTotal
            };
        });

        const finalTotal = subtotal;
        let orderDiscount = 0;

        if (appliedCoupon) {
            const Coupon = require('../models/couponModel');
            const couponDoc = await Coupon.findOne({ code: appliedCoupon.code, isActive: true });
            const minPurchase = couponDoc.minPurchaseAmount || 0;

            let hasUsed = false;
            if (couponDoc && couponDoc.usedBy) {
                hasUsed = couponDoc.usedBy.some(id => id.toString() === userId.toString());
            }

            if (couponDoc && !hasUsed && finalTotal >= minPurchase) {
                orderDiscount = appliedCoupon.discountAmount;
                couponDoc.usedBy.push(userId);
                await couponDoc.save();
            }
        }

        const netTotal = finalTotal - orderDiscount;
        const orderId = 'ORD-' + Date.now() + Math.floor(Math.random() * 1000);
        
        const newOrder = new Order({
            user: userId,
            orderId: orderId,
            items: orderItems,
            shippingAddress: {
                name: `${addressDoc.firstName} ${addressDoc.lastName}`,
                street: addressDoc.houseNo,
                city: addressDoc.city,
                district: addressDoc.district,
                state: addressDoc.state,
                pincode: addressDoc.pincode,
                phone: addressDoc.mobile
            },
            pricing: { subtotal: finalTotal, shipping: 0, discount: orderDiscount, total: netTotal },
            paymentMethod: paymentMethod,
            paymentStatus: 'Pending'
        });

        await newOrder.save();

        for (let item of validItems) {
            await Product.updateOne(
                { _id: item.product._id, "variants.size": item.size },
                { $inc: { "variants.$.stock": -item.quantity } }
            );
        }

        if (!buyNowItem && cartDoc) {
            cartDoc.items = [];
            await cartDoc.save();
        }

        return newOrder;

    } catch (error) {
        console.error("Checkout Service Error:", error);
        throw error;
    }
};