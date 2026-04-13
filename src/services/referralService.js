const User = require('../models/userModel');
const walletService = require('./walletService');
const crypto = require('crypto');

exports.generateReferralCode = async (firstName) => {
    const prefix = firstName.substring(0, 4).toUpperCase().padEnd(4, 'X');
    let isUnique = false;
    let newCode = '';

    while (!isUnique) {
        const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();
        newCode = `${prefix}${randomString}`;

        const existingUser = await User.findOne({ referralCode: newCode });
        if (!existingUser) isUnique = true;
    }

    return newCode;
}

exports.processReferral = async (usedCode, newUserDoc) => {
    if (!usedCode || usedCode.trim() === '') return;

    try {
        const referrer = await User.findOne({ referralCode: usedCode.toUpperCase() });

        if (referrer) {
            const referrerReward = 100;
            const newUserReward = 50;

            await walletService.creditWallet(
                referrer._id,
                referrerReward,
                `Referral Bonus: Invited ${newUserDoc.firstName}`
            );

            await walletService.creditWallet(
                newUserDoc._id,
                newUserReward,
                `Welcome Bonus: Used referral code ${usedCode.toUpperCase()}`
            );
        }
    } catch (error) {
        console.error("Referral Processing Error:", error);
    }
}