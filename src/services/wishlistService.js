const { isAborted } = require('zod/v3');
const Wishlist = require('../models/wishlistModel');

exports.getUserWishlist = async (userId) => {
    try {
        const Wishlist = require('../models/wishlistModel');
        const wishlist = await Wishlist.findOne({ user: userId }).populate({
            path: 'products',
            populate: {
                path: 'category',
                select: 'name isActive'
            }
        });

        if (wishlist && wishlist.products) {
            return wishlist.products.filter(product => product != null);
        }
        return [];
    } catch (error) {
        console.error("Wishlist Service Error:", error);
        throw error;
    }
}