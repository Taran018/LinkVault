'use strict';

// Set a placeholder MONGO_URI so env.js does not throw during module loading
// in tests.  The actual database connection is established in each test file's
// beforeAll hook using MongoMemoryServer, which starts a real MongoDB process
// in memory — no Atlas connection needed during tests.
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost/linkvault-test-placeholder';
process.env.NODE_ENV = 'test';
process.env.HOST = process.env.HOST || 'http://localhost:3000';
