const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const cookieParser = require('cookie-parser');
const { mongo } = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const shopRoutes = require('./routes/shopRoutes');
const Wishlist = require('./models/wishlistModel');
const Cart = require('./models/cartModel')
const passport = require('passport');
require('./config/passport');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.static(path.join(__dirname, '../public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dressrosa_secret', 
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60 
    }),
    cookie: {
        maxAge: 72 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false 
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    const currentUser = req.user || req.session.user || null;
    
    if (currentUser) {
        const userData = currentUser._doc || currentUser;
        res.locals.user = {
            ...userData, 
            name: userData.firstName || userData.name || "User",
            id: userData._id || userData.id || null
        };
    } else {
        res.locals.user = null;
    }
    next();
});

app.use(async (req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    res.locals.wishlistCount = 0;

    if (req.session && req.session.user) {
        try {
            const wishlist = await Wishlist.findOne({ user: req.session.user._id });
            if (wishlist) {
                res.locals.wishlistCount = wishlist.products.length;
            }
        } catch (error) {
            console.error("Global Wishlist Error:", error);
        }
    }
    next();
});

app.use(async (req, res, next) => {

    if (!res.locals) res.locals = {};

    try {
        let userId;
        const currentUser = req.user || (req.session && req.session.user);
        if (currentUser) {
            userId = typeof currentUser === 'string' ? currentUser : (currentUser._id || currentUser.id);
        }

        if (userId) {
            const cart = await Cart.findOne({ user: userId });
            res.locals.cartCount = cart && cart.items ? cart.items.length : 0;
        } else {
            res.locals.cartCount = 0;
        }
        next();
    } catch (error) {
        console.error("Global Badge Count Error:", error);
        res.locals.cartCount = 0;
        next();
    }
});


app.use('/', adminRoutes);
app.use('/', authRoutes);
app.use('/', shopRoutes);


app.use('/', require('./routes/profileRoutes'));
app.use('/', require('./routes/categoryRoutes'));
app.use('/', require('./routes/productRoutes'));


module.exports = app;