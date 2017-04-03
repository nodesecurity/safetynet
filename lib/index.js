'use strict';

const PubSub = require('@google-cloud/pubsub');

const internals = {};
internals.options = {
  retries: 3,
  attemptsKey: '_attempts',
  failBehavior: 'error',
  errorTopic: 'safetynet-errors'
};


exports.authenticate = (creds) => {

  internals.creds = creds;
};


exports.configure = (options) => {

  if (options.failBehavior &&
      !['error', 'republish'].includes(options.failBehavior)) {

    throw new Error(`Invalid failure behavior specified, must be one of 'error' or 'republish'`);
  }

  Object.assign(internals.options, options);
};


exports.catch = (fn) => {

  return (event) => {

    let data = (event.data.hasOwnProperty('@type') && event.data['@type'].endsWith('PubsubMessage')) ? JSON.parse(Buffer.from(event.data.data, 'base64')) : event.data;
    return fn(data, event).catch((err) => {

      if (!data.hasOwnProperty(internals.options.attemptsKey)) {
        data[internals.options.attemptsKey] = 0;
      }
      data[internals.options.attemptsKey]++;

      if (data[internals.options.attemptsKey] > internals.options.retries) {
        if (internals.options.failBehavior === 'error') {
          const err = new Error('Too many retries attempted, aborting');
          err.data = data;
          return Promise.reject(err);
        }

        if (internals.options.failBehavior === 'republish') {
          return PubSub(internals.creds).topic(internals.options.errorTopic).get().then(([topic]) => {

            return topic.publish(data);
          }).then(() => {

            const err = new Error(`Too many retries attempted, publishing to ${internals.options.errorTopic}`);
            err.data = data;
            return Promise.reject(err);
          });
        }
      }

      let topicName = event.resource.split('/').pop();
      return PubSub(internals.creds).topic(topicName).get().then(([topic]) => {

        return topic.publish(data).then(() => {

          return Promise.reject(err);
        });
      });
    });
  };
};
