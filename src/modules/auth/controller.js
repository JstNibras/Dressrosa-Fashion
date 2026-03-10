const bcrypt = require('bcrypt');
const User = require('./userModel');
const sendOtpEmail = require('../../utils/sendOtp');
const { signupSchema, loginSchema, forgotPasswordSchema, newPasswordSchema, otpSchema } = require('../../utils/validators');
const userModel = require('./userModel');
const { cloudinary } = require('../../config/cloudinary');

exports.signup = async (req, res) => {
    try {
        const validation = signupSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.render('user/signup', {
                errors: errors,
                oldData: req.body
            });
        }

        const { firstName, lastName, email, password, phone } = validation.data;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/signup', {
                errors: { email: ["Email already registered"] },
                oldData: req.body
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        req.session.tempUser = { firstName, lastName, email, password, phone};
        req.session.otp = otp;
        req.session.otpType = 'signup'
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000

        await sendOtpEmail(email, otp);
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            res.redirect('/verify-otp');
        });
    } catch (error){
        console.error("Signup/OTP Error:", error);
        res.status(500).send("Error Sending OTP");
    }
};
    
exports.login = async (req, res) => {
    try {
        const validation = loginSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.render('user/login', {
                errors: errors,
                oldData: req.body
            });
        }
        const { email, password } = validation.data;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/login', { 
                errors: { email: ["Account not found"] }, 
                oldData: req.body 
            });
        }

        if (user.isBlocked) {
            return res.render('user/login', { 
                errors: { email: ["This account has been suspended"] }, 
                oldData: req.body 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render('user/login', { 
                errors: { password: ["Incorrect password"] }, 
                oldData: req.body 
            });
        }
        req.session.user = {
            id: user._id,
            name: user.firstName,
            email: user.email
        };
        req.session.save((err) => {
            if (err) {
                return res.status(500).send("Internal Server Error");
            }
            res.redirect('/');
        });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
}

exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);

        req.session.destroy((err) => {
            if (err) {
                console.log("Logout error:", err);
                return res.redirect('/');
            }
            res.clearCookie('connect.sid'); 
            res.redirect('/login');
        });
    })
};

exports.updateProfileImage = async (req, res) => {
    try {
        if (!req.file) return res.redirect('/profile?error=NoImage');

        const userId = req.session.user.id;
        const imageUrl = req.file.url || req.file.path;

        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { profileImage: imageUrl }, 
            { new: true }
        );

        req.session.user.profileImage = updatedUser.profileImage;

        res.redirect('/profile?success=Image Updated')
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        res.status(500).send("Upload failed");
    }
};

exports.removeProfileImage = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);

        if (user.profileImage && !user.profileImage.includes('default-avatar')) {
            const publicId = user.profileImage.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId);
        }

        user.profileImage = '/images/Default/images.jpg';
        await user.save();

        req.session.user.profileImage = user.profileImage;

        res.redirect('/profile?success=ImageRemoved')
    } catch (error) {
        console.error("Remove Image Error:", error);
        res.status(500).send("Failed to remove image");
    }
}

exports.verifyOtp = async (req, res) => {
    try {
        console.log("--- OTP Submission Received ---");
        console.log("Body Data:", req.body);

        const { otp1, otp2, otp3, otp4 } = req.body;
        const enteredOtp = `${otp1}${otp2}${otp3}${otp4}`;
        console.log("Combined OTP:", enteredOtp);

        const { otp: sessionOtp, otpExpiry, otpType } = req.session;
        console.log("Session OTP:", sessionOtp);
        console.log("Is Expired:", Date.now() > otpExpiry);

        if (!sessionOtp || !otpExpiry) {
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        if (Date.now() > otpExpiry) {
            delete req.session.otp;
            delete req.session.otpExpiry;
            return res.status(400).json({ success: false, message: "OTP Expired. Please request a new one.", isExpired: true });
        }

        if (enteredOtp !== sessionOtp ) {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }

        switch (otpType) {
            case 'signup':
                const { firstName, lastName, email, password, phone } = req.session.tempUser;
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                const newUser = new User({
                    firstName, lastName, email, password: hashedPassword, phone
                });
                await newUser.save();
                delete req.session.otp;
                delete req.session.otpType;
                return res.json({ success: true, redirectUrl: '/login' });

            case 'forgotPassword':
                req.session.isOtpVerified = true;
                delete req.session.otp;
                delete req.session.otpType;
                return req.session.save(() => res.json({ success: true, redirectUrl: '/new-password' }));

            case 'emailChange':
                const userId = req.session.user.id;
                await User.findByIdAndUpdate(userId, { email: req.session.newEmail});
                req.session.user.email = req.session.newEmail;
                delete req.session.newEmail;
                return res.json({ success: true, redirectUrl: '/profile?success=EmailUpdate' });
        }

        const type = otpType;
        delete req.session.otp;
        delete req.session.otpExpiry;
        delete req.session.otpType;
        if(req.session.tempUser) delete req.session.tempUser;

        let redirectUrl = '/login?success=verified';
        if(type === 'forgotPassword') redirectUrl = '/new-password';
        if(type === 'emailChange') redirectUrl = '/profile?success=EmailUpdate';
        return res.json({ success: true, redirectUrl });
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.forgotPasswordRequest = async (req, res) => {
    try {
        const validation = forgotPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.render('user/forgot-password', { errors: errors, oldData: req.body })
        }

        const { email } = validation.data;
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgot-password', { 
                errors: { email: ["Email not found in our records"] }, 
                oldData: req.body 
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = otp;
        req.session.otpType = 'forgotPassword';
        req.session.forgotEmail = email;
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

        await sendOtpEmail(email, otp);
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            res.redirect('/verify-otp');
        });
    } catch (error) {
        res.status(500).send("Error");
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const validation = newPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return res.render('user/new-password', { errors: errors });
        }

        const { password, confirmPassword } = validation.data;
        const email = req.session.forgotEmail;

         if (!password || !confirmPassword) {
            return res.render('user/new-password', { error: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.render('user/new-password', { error: "Passwords do not match"});
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.findOneAndUpdate({ email: email }, { password: hashedPassword});

        delete req.session.isOtpVerified;
        delete req.session.forgotEmail;

        res.redirect('/login?success=Password reset Successful. Please login.');
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.changeEmailRequest = async (req, res) => {
    try {
        const { newEmail } = req.body;

        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.redirect('/profile/edit?error=Email already in use');
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = otp;
        req.session.otpType = 'emailChange';
        req.session.newEmail = newEmail;
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

        await sendOtpEmail(newEmail, otp);

        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            res.redirect('/verify-otp');
        });
    } catch (error) {
        res.status(500).send("Error");
    }
};

exports.resendOtp = async (req, res) => {
    try {
        const { otpType, tempUser, forgotEmail, newEmail } = req.session;

        if (!otpType) {
            return res.json({ success: false, message: "Session expired. Please restart the process"});
        }

        let targetEmail;
        if(otpType === 'signup') targetEmail = tempUser.email;
        else if(otpType === 'forgotPassword') targetEmail = forgotEmail;
        else if(otpType === 'emailChange') targetEmail = newEmail;

        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = newOtp;
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

        await sendOtpEmail(targetEmail, newOtp);

        res.json({ success: true, message: "New OTP sent successfully!!" });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
}