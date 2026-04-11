const Wallet = require('../models/walletModel');

exports.getWallet = async (userId) => {
    let wallet = await Wallet.findOne({ user: userId });
    if(!wallet) {
        wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        await wallet.save();
    }
    return wallet;
};

exports.creditWallet = async (userId, amount, description, session = null) => {
    const wallet = await this.getWallet(userId);
    wallet.balance += Number(amount);
    wallet.transactions.push({ amount: Number(amount), type: 'Credit', description });

    if (session) {
        await wallet.save({ session });
    } else {
        await wallet.save();
    }
    return wallet;
};

exports.debitWallet = async (userId, amount, description) => {
    const wallet = await this.getWallet(userId);
    if (wallet.balance < amount) throw new Error("Insufficient wallet balance.");

    wallet.balance -= Number(amount);
    wallet.transactions.push({ amount: Number(amount), type: 'Debit', description });
    await wallet.save();
    return wallet; 
};