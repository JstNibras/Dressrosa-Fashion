const walletService = require('../services/walletService');

exports.getWalletPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const wallet = await walletService.getWallet(userId);

        wallet.transactions.sort((a, b) => b.date - a.date);

        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedTransactions = wallet.transactions.slice(startIndex, endIndex);

        res.render('user/wallet', { 
            walletBalance: wallet.balance,
            transactions: paginatedTransactions,
            currentPage: page,
            totalPages: totalPages     
        });
    } catch (error) {
        console.error("Wallet Page Error:", error);
        res.redirect('/profile?error=WalletError');
    }
};