const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});
const app = require('./app');
const connectDB = require('./config/db');


const PORT = process.env.PORT || 3000;




connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Dressrosa Server running at http://localhost:${PORT}`);
    });
});