const Wishlist = require('./wishlistModel');
const wishlistService = require('./wishlistService');

exports.toggleWishlist = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to add items to your wishlist.' })
        }

        const userId = req.session.user._id;
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
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const products = await wishlistService.getUserWishlist(req.session.user._id);

        res.render('user/wishlist', {
            products: products
        });
    } catch (error) {
        console.error("Load Wishlist Error:", error);
        res.status(500).send("Server Error");
    }
}