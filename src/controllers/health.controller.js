'use strict';

// Health controller — used by GET /health.
// Returns a simple JSON object so load balancers and monitoring tools can
// verify the server is up without touching the database.
function getHealth(req, res) {
  res.status(200).json({ status: 'ok' });
}

module.exports = { getHealth };
