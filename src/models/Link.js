'use strict';

const mongoose = require('mongoose');

// WHY A SCHEMA?
// Mongoose schemas define the shape of documents stored in MongoDB, enforce
// types, run validation before saving, and let us add indexes declaratively.
//
// WHY a unique index on `code`?
// If two requests race to create the same code at the same instant, MongoDB
// rejects the second insert with a duplicate-key error (code 11000).  The
// service layer catches that error and retries with a fresh code.

const linkSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      // unique: true tells Mongoose to create a unique index in MongoDB.
      // MongoDB enforces this at the storage layer, so duplicates are
      // impossible even under concurrent writes.
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    longUrl: {
      type: String,
      required: true,
    },
    // clicks is always updated with { $inc: { clicks: 1 } }, never by
    // reading the current value and writing value+1.  Atomic $inc is safe
    // under any level of concurrency.
    clicks: {
      type: Number,
      default: 0,
    },
    // null means the link never expires.  A future Date means it expires then.
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    // timestamps: true makes Mongoose add `createdAt` and `updatedAt`
    // automatically.  We disable `updatedAt` because we never update links.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('Link', linkSchema);
