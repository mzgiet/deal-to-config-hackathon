const { registerConfigure } = require('./configure');
const { registerCardActions } = require('./card-actions');
const { registerAdjust } = require('./adjust');

function registerSlack(app) {
  registerConfigure(app);
  registerCardActions(app);
  registerAdjust(app);
}

module.exports = { registerSlack };
