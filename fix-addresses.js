require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./src/modules/auth/userModel');
const Address = require('./src/modules/profile/addressModel');

async function fixUnlinkedAddresses() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
        console.error("No MONGODB_URI found");
        process.exit(1);
    }
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB.");

    const addresses = await Address.find();
    console.log(`Found ${addresses.length} total addresses.`);

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

    console.log(`Finished fixing addresses. Total fixed: ${fixedCount}`);
    process.exit(0);

  } catch (err) {
    console.error("Error connecting to DB or fixing addresses", err);
    process.exit(1);
  }
}

fixUnlinkedAddresses();
