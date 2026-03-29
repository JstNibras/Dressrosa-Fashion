const { isAborted } = require('zod/v3');
const Wishlist = require('../models/wishlistModel');

exports.getUserWishlist = async (userId) => {
    try {
        const Wishlist = require('../models/wishlistModel');
        const wishlist = await Wishlist.findOne({ user: userId }).populate({
            path: 'products',
            match: { isActive: { $ne: false } },
            populate: {
                path: 'category',
                match: { isActive: { $ne: false } },
                select: 'name'
            }
        });

        if (wishlist && wishlist.products) {
            return wishlist.products.filter(product => product && product.category);
        }
        return [];
    } catch (error) {
        console.error("Wishlist Service Error:", error);
        throw error;
    }
}