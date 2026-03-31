const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');

exports.placeOrder = async (userId, addressId, paymentMethod) => {
    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        const addressDoc = await Address.findById(addressId);

        if (!cart || cart.items.length === 0) throw new Error("Cart is empty");
        if (!addressDoc) throw new Error("Delivery address not found");

        let subtotal = 0;

        const validItems = cart.items.filter(item => item.product != null);
        if (validItems.length === 0) throw new Error("NO valid items found in cart during checkout.");

        const orderItems = cart.items.map(item => {
            const itemTotal = item.quantity * item.product.salePrice;
            subtotal += itemTotal;

            let productImage = '/images/default-product.png'; 
            
            if (item.product.images && item.product.images.length > 0) {
                productImage = item.product.images[0];
            } else if (item.product.image && item.product.image.length > 0) {
                productImage = item.product.image[0]; 
            }

            return {
                productId: item.product._id,
                name: item.product.name,
                image: productImage,
                price: item.product.salePrice,
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
            pricing: { subtotal, shipping: 0, toatal: finalTotal },
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Completed'
        });

        await newOrder.save();

        for (let item of cart.items) {
            await Product.updateOne(
                { _id: item.product._id, "variants.size": item.size },
                { $inc: { "cariants.$stock": -item.quantity } }
            );
        }

        cart.items = [];
        await cart.save();

        return newOrder;
    } catch (error) {
        console.error("Checkout Service Error:", error);
        throw error;
    }
};