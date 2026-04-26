const Wishlist = require('../models/wishlistModel');
const wishlistService = require('../services/wishlistService');

exports.toggleWishlist = async (req, res) => {
    try {
        const currentUser = req.user || (req.session ? req.session.user : null);
        if (!currentUser) {
            return res.status(401).json({ success: false, message: 'Please log in to add items to your wishlist.' })
        }

        const userId = currentUser._id || currentUser.id;
        const productId = req.body.productId;

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [] });
        }

        const productIndex = wishlist.products.indexOf(productId);
        let isAdded;

        if (productIndex > -1) {
            wishlist.products.splice(productIndex, 1);
            isAdded = false;
        } else {
            wishlist.products.push(productId);
            isAdded = true;
        }

        await wishlist.save();

        res.status(200).json({
            success: true,
            isAdded: isAdded,
            wishlistCount: wishlist.products.length
        });

    } catch (error) {
        console.error("Wishlist Toggle Error:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    } 
};

exports.getWishlistPage = async (req, res) => {
    try {
        const currentUser = req.user || (req.session ? req.session.user : null);
        if (!currentUser) {
            return res.redirect('/login');
        }

        const userId = currentUser._id || currentUser.id;
        const products = await wishlistService.getUserWishlist(userId);

        res.render('user/wishlist', {
            products: products
        });
    } catch (error) {
        console.error("Load Wishlist Error:", error);
        res.status(500).send("Server Error");
    }
}