const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');

exports.placeOrder = async (userId, addressId, paymentMethod) => {
    try {
        const cartDoc = await Cart.findOne({ user: userId }).populate('items.product');
        const addressDoc = await Address.findById(addressId);

        if (!cartDoc || cartDoc.items.length === 0) throw new Error("Cart is empty");
        if (!addressDoc) throw new Error("Delivery address not found");

        const pureCart = JSON.parse(JSON.stringify(cartDoc));

        let subtotal = 0;
        const validItems = pureCart.items.filter(item => item.product != null);
        if (validItems.length === 0) throw new Error("No valid items found in cart during checkout.");

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
            pricing: { subtotal, shipping: 0, total: finalTotal },
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Completed'
        });

        await newOrder.save();

        for (let item of validItems) {
            await Product.updateOne(
                { _id: item.product._id, "variants.size": item.size },
                { $inc: { "variants.$.stock": -item.quantity } }
            );
        }

        // 5. Empty the Cart (Using the original Mongoose Document)
        cartDoc.items = [];
        await cartDoc.save();

        return newOrder;

    } catch (error) {
        console.error("Checkout Service Error:", error);
        throw error;
    }
};