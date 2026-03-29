const cartService = require('../services/cartService');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');
const Address = require('../models/addressModel');

exports.getCartPage = async (req, res) => {
    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);
        if (currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }

        if (!userId) {
            return res.redirect('/login'); 
        }

        const cartData = await cartService.getCartData(userId);

        const addresses = await Address.find({ user: userId });

        const defaultAddress = addresses.find(a => a.isDefault) || addresses[0] || null;

        res.render('user/cart', {
            cartItems: cartData.items,
            cartTotal: cartData.cartTotal,
            isCheckoutValid: cartData.isCheckoutValid,
            addresses: addresses,
            defaultAddress: defaultAddress
        });

    } catch (error) {
        console.error("Cart Page Error:", error);
        res.status(500).send("Server Error");
    }
};

exports.updateQuantity = async (req, res) => {
    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);
        if (currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }

        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { itemId, quantity } = req.body;
        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart' });

        const product = await Product.findById(item.product);
        const variant = product.variants.find(v => v.size === item.size);

        const liveStock = variant ? variant.stock : 0;
        const requestedQty = parseInt(quantity);

        if (requestedQty > liveStock) {
            return res.status(400).json({ success: false, message: `Only ${liveStock} items left in stock.` });
        }

        if (requestedQty > 5) {
            return res.status(400).json({ success: false, message: 'Maximum 5 units allowed per order.' });
        }

        item.quantity = requestedQty;
        await cart.save();

        res.status(200).json({ success: true, message: 'Quantity updated' });
    } catch (error) {
        console.error("Update Qty Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);
        if (currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }

        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { itemId } = req.body;
        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        cart.items.pull({ _id: itemId });
        await cart.save();

        res.status(200).json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error("Remove Item Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.addToCart = async (req, res) => {
    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);

        if (currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to add items to your cart.' });
        }

        const { productId, size, quantity = 1 } = req.body;
        const requestedQty = parseInt(quantity);

        const Product = require('../models/productModel');
        const product = await Product.findById(productId);
        if(!product || !product.isActive) {
            return res.status(404).json({ success: false, message: 'Product is unavailable.' });
        }

        const variant = product.variants.find(v => v.size === size && v.isActive);
        if (!variant) {
            return res.status(400).json({ success: false, message: 'Selected size is unavailable.' });
        }

        if (requestedQty > variant.stock) {
            return res.status(400).json({ success: false, message: `Only ${variant.stock} left in stock.` });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId && item.size === size
        );

        if (existingItemIndex > -1) {
            const newQty = cart.items[existingItemIndex].quantity + requestedQty;

            if (newQty > 5) {
                return res.status(400).json({ success: false, message: 'Maximum 5 units allowed per order. You already have this in your cart.' });
            }
            if (newQty > variant.stock) {
                return res.status(400).json({ success: false, message: `Cannot add more. Only ${variant.stock} left in stock.` });
            }

            cart.items[existingItemIndex].quantity = newQty;
        } else {
            if (requestedQty > 5) {
                return res.status(400).json({ success: false, message: 'Maximum 5 units allowed.' });
            }
            cart.items.push({
                product: productId,
                size: size,
                color: variant.color || 'N/A',
                quantity: requestedQty
            });
        }

        await cart.save();
        res.status(200).json({ success: true, message: 'Added to cart successfully!', cartCount: cart.items.length });
    } catch (error) {
        console.error("Add to Cart Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

exports.updateSize = async (req, res) => {
    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);
        if(currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { itemId, newSize } = req.body;
        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const itemToUpdate = cart.items.id(itemId);
        if (!itemToUpdate) return res.status(404).json({ success: false, message: 'Item not found' });

        const Product = require('../models/productModel');
        const product = await Product.findById(itemToUpdate.product);
        const newVariant = product.variants.find(v => String(v.size).trim() === String(newSize).trim() && v.isActive !== false);

        if (!newVariant || newVariant.stock === 0) {
            return res.status(400).json({ success: false, message: 'That size is out of stock.' });
        }

        const existingItemIndex = cart.items.findIndex(
            i => i.product.toString() === itemToUpdate.product.toString() &&
                 i.size === newSize &&
                 i._id.toString() !== itemId
        );

        if (existingItemIndex > -1) {
            const combinedQty = cart.items[existingItemIndex].quantity + itemToUpdate.quantity;

            if (combinedQty > 5) return res.status(400).json({ success: false, message: 'Cannot merge. Maximum 5 units allowed.' });
            if (combinedQty > newVariant.stock) return res.status(400).json({ success: false, message: `Cannot merge. Only ${newVariant.stock} left in stock.` });

            cart.items[existingItemIndex].quantity = combinedQty;
            cart.items.pull({ _id: itemId })
        } else {
            if (itemToUpdate.quantity > newVariant.stock) {
                itemToUpdate.quantity = newVariant.stock;
            }
            itemToUpdate.size = newSize;
        }

        await cart.save();
        res.status(200).json({ success: true, message: 'Size updated Successfully' })
    } catch (error) {
        console.error("Update Size Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}