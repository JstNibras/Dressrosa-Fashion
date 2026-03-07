const mongoose = require('mongoose');

const connectDB = require('mongoose').connect; 

const connect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected Successfully");
        
    } catch (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
};

module.exports = connect;