'use strict';

const { connectDB } = require('./config/db');
const { PORT } = require('./config/env');
const app = require('./app');

// server.js is the entry point for the real running server.
// It first connects to MongoDB, then starts listening for HTTP requests.
// Doing it in this order means we never accept traffic before the DB is ready.
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${process.env.NODE_ENV})`);
  });
}

start();
