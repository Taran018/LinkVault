'use strict';

const mongoose = require('mongoose');

// WHY A CLICK MODEL?
// While Link.clicks stores an aggregate counter for fast display,
// the Click model stores an individual event document for every visit.
// This enables analytics (e.g., clicks over time, top referrers) in Phase 5.
//
// WHY linkId AND code?
// `linkId` ties the click event immutably to a specific Link document.
// Even if an alias is deleted and recreated later for a different destination,
// past click events remain attributed to the original link.
// `code` is a snapshot of the short code at the moment the click occurred.

const clickSchema = new mongoose.Schema(
  {
    linkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Link',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    referrer: {
      type: String,
      default: null,
      maxlength: 2048,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 512,
    },
  },
  {
    // Clicks are immutable audit records; updatedAt is not needed.
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes optimize Phase 5 time-series queries (e.g., clicks in last 7 days)
clickSchema.index({ linkId: 1, at: -1 });
clickSchema.index({ code: 1, at: -1 });

module.exports = mongoose.model('Click', clickSchema);
