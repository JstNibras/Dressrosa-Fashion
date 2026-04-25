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
const adminSession = session({
    name: 'admin.sid',
    secret: process.env.SESSION_SECRET || 'dressrosa_secret', 
    resave: false,
    saveUninitialized: false, 
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'admin_sessions',
        ttl: 24 * 60 * 60 
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false 
    }
});

const userSession = session({
    name: 'user.sid',
    secret: process.env.SESSION_SECRET || 'dressrosa_secret', 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'user_sessions',
        ttl: 72 * 60 * 60 
    }),
    cookie: {
        maxAge: 72 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false 
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) {
        adminSession(req, res, next);
    } else {
        userSession(req, res, (err) => {
            if (err) return next(err);
            passport.initialize()(req, res, () => {
                passport.session()(req, res, next);
            });
        });
    }
});

app.use(async (req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    res.locals.admin = req.session ? req.session.admin : null;
    
    const currentUser = req.user || res.locals.user;
    if (currentUser) {
        const userData = currentUser._doc || currentUser;
        res.locals.user = {
            ...userData,
            name: userData.firstName || userData.name || "User",
            id: userData._id || userData.id || null
        };
    }

    res.locals.wishlistCount = 0;
    res.locals.cartCount = 0;
    res.locals.wishlist = [];

    if (res.locals.user && res.locals.user.id) {
        try {
            const userId = res.locals.user.id;
            const [wishlist, cart] = await Promise.all([
                Wishlist.findOne({ user: userId }),
                Cart.findOne({ user: userId })
            ]);
            
            if (wishlist) {
                res.locals.wishlistCount = wishlist.products.length;
                res.locals.wishlist = wishlist.products.map(p => p.toString());
            }
            if (cart && cart.items) {
                res.locals.cartCount = cart.items.length;
            }
        } catch (error) {
            console.error("Global Badge Count Error:", error.message);
        }
    }
    next();
});


app.use('/', adminRoutes);
app.use('/', authRoutes);
app.use('/', shopRoutes);


app.use('/', require('./routes/profileRoutes'));
app.use('/', require('./routes/categoryRoutes'));
app.use('/', require('./routes/productRoutes'));


module.exports = app;