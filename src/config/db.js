'use strict';

const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

// connectDB establishes a single Mongoose connection that is reused across all
// requests.  Mongoose keeps a connection pool internally, so we only call this
// once at startup in server.js.
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('DB connected:', mongoose.connection.host);
  } catch (err) {
    // Exit the process on connection failure so the process manager (Render,
    // nodemon) can restart it — rather than running with no DB connection.
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
