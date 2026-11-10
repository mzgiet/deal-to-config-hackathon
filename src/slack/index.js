const { registerConfigure } = require('./configure');
const { registerQuote } = require('./quote');
const { registerCardActions } = require('./card-actions');
const { registerAdjust } = require('./adjust');

function registerSlack(app) {
  registerConfigure(app);
  registerQuote(app);
  registerCardActions(app);
  registerAdjust(app);
}

module.exports = { registerSlack };
