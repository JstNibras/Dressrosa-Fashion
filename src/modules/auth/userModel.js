const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    firstName : { type : String, require : true},
    lastName : { type : String, require : true},
    email : { type : String, require : true, unique : true, lowercase : true},
    password : { type : String, require : true},
    phone : { type : String, require : true},
    referralCode : {type : String},
    wallet : { type : Number, default : 0},
    isBlocked : {  type : Boolean, default : false},
    addresses : [{ type : mongoose.Schema.Types.ObjectId, ref : 'Address'}],
}, {timestamps : true});

userSchema.virtual('name').get(function() {
    return this.firstName || "User";
});

module.exports = mongoose.model('User', userSchema);

