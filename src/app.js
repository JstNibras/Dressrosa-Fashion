const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const cookieParser = require('cookie-parser');
const { mongo } = require('mongoose');
const authRoutes = require('./modules/auth/routes');
const adminRoutes = require('./modules/admin/routes');
const shopRoutes = require('./modules/shop/routes');
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


app.use('/', adminRoutes);
app.use('/', authRoutes);
app.use('/', shopRoutes);


app.use('/', require('./modules/profile/routes'));
app.use('/', require('./modules/category/routes'));
app.use('/', require('./modules/product/routes'));


module.exports = app;