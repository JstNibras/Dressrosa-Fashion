const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../modules/auth/userModel');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8000/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    try {
        console.log(profile)
        let user = await User.findOne({ email: profile.emails[0].value})

        if (user) {
            if (user.isBlocked) {
                return done(null, false, { message: 'User is blocked by admin' });
            }
            return done(null, user);
        } else {
            const newUser = await User({
                firstName: profile.name.givenName,
                lastName: profile.name.familyName || '',
                email: profile.emails[0].value,
                googleId: profile.id,
                isVerified: true, 
                password: '' 
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (err) {
        return done(err, null);
    }
}
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
})