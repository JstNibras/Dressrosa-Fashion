const walletService = require('../services/walletService');

exports.getWalletPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const wallet = await walletService.getWallet(userId);

        wallet.transactions.sort((a, b) => b.date - a.date);

        res.render('user/wallet', { wallet });
    } catch (error) {
        console.error("Wallet Page Error:", error);
        res.redirect('/profile?error=WalletError');
    }
};