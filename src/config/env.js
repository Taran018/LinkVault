'use strict';

// dotenv reads the .env file and puts every key into process.env so the rest
// of the app can access secrets without hard-coding them in source files.
require('dotenv').config();

// Fail fast: if MONGO_URI is missing, throw during startup so the developer
// sees a clear message instead of a cryptic Mongoose connection error later.
if (!process.env.MONGO_URI) {
  throw new Error(
    'Missing MONGO_URI in .env.  Copy .env.example to .env and fill it in.'
  );
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGO_URI: process.env.MONGO_URI,
  // HOST is the public base URL, used when building short links and to reject
  // URLs that would redirect back to this service (redirect-loop prevention).
  HOST: process.env.HOST || 'http://localhost:3000',
};

module.exports = env;
