require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./src/modules/auth/userModel');
const Address = require('./src/modules/profile/addressModel');

async function check() {
  try {
    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/dressrosa-fashion";
    await mongoose.connect(mongoURI);

    const addresses = await Address.find();
    console.log(`Addresses in DB: ${addresses.length}`);

    let fixedCount = 0;
    for (const address of addresses) {
      if (address.user) {
        const user = await User.findById(address.user);
        if (user) {
          const hasAddress = user.addresses.some(id => id.toString() === address._id.toString());
          if (!hasAddress) {
            user.addresses.push(address._id);
            await user.save();
            console.log(`Linked address ${address._id} to user ${user.email}`);
            fixedCount++;
          }
        }
      }
    }
    console.log(`Fixed ${fixedCount} unlinked addresses.`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
