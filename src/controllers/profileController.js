const User = require('../models/userModel');
const Address = require('../models/addressModel');
const { profileSchema, addressSchema, changePasswordSchema } = require('../utils/validators')
const bcrypt = require('bcrypt');
const axios = require('axios');

const getProfile = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        if (!userId) return res.redirect('/login');

        const user = await User.findById(userId).populate('addresses');
        
        let defaultAddress = null;
        if (user.addresses && user.addresses.length > 0) {
           defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
        }

        res.render('user/profile', { user, defaultAddress });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getEditProfile = async (req, res) => {
     try {
        const userId = req.session.user ? req.session.user.id : null;
        if (!userId) return res.redirect('/login');

        const user = await User.findById(userId);
        res.render('user/edit-profile', { user });
    } catch (error) {
        console.error('Error fetching edit profile:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postEditProfile = async (req, res) => {
    try {
        const validation = profileSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;

            const user = await User.findById(req.session.user.id);

            return res.render('user/edit-profile', {
                errors: errors,
                user: { ...user._doc, ...req.body }
            });
        }

        const { firstName, lastName, phone } = validation.data;
        const userId = req.session.user.id;

        await User.findByIdAndUpdate(userId, { firstName, lastName, phone });

        req.session.user.name = firstName;

        res.redirect('/profile?success=Profile updated successfully')
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getChangePassword = (req, res) => {
    res.render('user/change-password', { 
        user: req.session.user,
        errors: {}, 
        oldData: {}
    });
}

const postChangePassword = async (req, res) => {
    try {
        const validation = changePasswordSchema.safeParse(req.body);
        if (!validation.success) {
            return res.render('user/change-password', {
                user: req.session.user,
                errors: validation.error.flatten().fieldErrors,
                oldData: req.body
            });
        }

        const { currentPassword, newPassword } = validation.data;
        const user = await User.findById(req.session.user.id);

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.render('user/change-password', {
                errors: { currentPassword: ["Incorrect current password"] },
                oldData: req.body
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.redirect('/profile?success=Password changed successfully');
    
    } catch (error) {
        consolr.error("Change Password Error:", error);
        res.status(500).send("Internal Server Error");
    }
}

const getAddresses = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        if (!userId) return res.redirect('/login');

        const addresses = await Address.find({ user: userId });
        res.render('user/addresses', { addresses, user: req.session.user });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getAddAddress = async (req, res) => {
     try {
        res.render('user/add-address', { 
            user: req.session.user, 
            errors: {}, 
            oldData: {} 
        });
    } catch (error) {
        res.status(500).send("Error loading page");
    }
};

const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addressId = req.params.id;

        await Address.updateMany({ user: userId }, { isDefault: false });

        await Address.findByIdAndUpdate(addressId, { isDefault: true });

        res.redirect('/profile/addresses');
    } catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postAddAddress = async (req, res) => {
     try {
        const validation = addressSchema.safeParse(req.body);

        if(!validation.success) {
            const errors = validation.error.flatten().fieldErrors;

            return res.render('user/add-address', {
                user: req.session.user,
                errors: errors,
                oldData: req.body
            });
        }

        const { pincode, state, district, city } = validation.data;

        try {
            const pincodeRes = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
            const pinData = pincodeRes.data[0];

            if (pinData.Status === "Success") {
                const officialState = pinData.PostOffice[0].State;
                const officialDistrict = pinData.PostOffice[0].District;

                if (state.toLowerCase() !== officialState.toLowerCase() ||
                    district.toLocaleLowerCase() !== officialDistrict.toLowerCase()) {
                        return res.render('user/add-address', {
                            user: req.session.user,
                            errors: { pincode: [`Pincode ${pincode} does not match ${district}, ${state}`]},
                            oldData: req.body
                        });
                }
            } else {
                return res.render('user/add-address', {
                    user: req.session.user,
                    errors: { pincode: ["Invalid Pincode provided"] },
                    oldData: req.body
                });
            }
        } catch (apiErr) {
            console.error("Pincode API Error:", apiErr);
        }

        const addressData = {
            ...validation.data,
            user: req.session.user.id
        };

        const existingAddress = await Address.findOne({ user: req.session.user.id });
        if (!existingAddress) {
            addressData.isDefault = true;
        }

        const newAddress = await Address.create(addressData);
        
        await User.findByIdAndUpdate(req.session.user.id, {
            $push: { addresses: newAddress._id }
        });

        res.redirect('/profile/addresses?success=Address added successfully');

    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findById(addressId);
        
        if (!address) {
            return res.redirect('/profile/addresses?error=Address not found')
        }

        res.render('user/edit-address', {
            user: req.session.user,
            address: address,
            errors: {},
            oldData: {}
        });

    } catch (error) {
        console.error('Error fetching edit address:', error);
        res.status(500).send('Internal Server Error');
    }
};


const postEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const validation = addressSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;

            return res.render('user/edit-address', {
                user: req.session.user,
                address: { ...req.body, _id: addressId },
                errors: errors,
                oldData: req.body
            });
        }

        await Address.findByIdAndUpdate(addressId, validation.data);
        res.redirect('/profile/addresses?success=Address updated');
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};

const postDeleteAddress = async (req, res) => {
    try {
         const addressId = req.params.id;
         const userId = req.session.user ? req.session.user.id : null;

         await Address.findByIdAndDelete(addressId);
         
         if (userId) {
             await User.findByIdAndUpdate(userId, {
                $pull: { addresses: addressId }
            });
         }

         res.redirect('/profile/addresses');
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).send('Internal Server Error');
    }
};


module.exports = {
    getProfile,
    getEditProfile,
    postEditProfile,
    getAddresses,
    getAddAddress,
    postAddAddress,
    getEditAddress,
    postEditAddress,
    postDeleteAddress,
    setDefaultAddress,
    getChangePassword,
    postChangePassword
};
