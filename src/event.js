'use strict';

const https = require('https');
const AWS = require('aws-sdk');

const aws_default_region = process.env.AWS_DEFAULT_REGION
if (!AWS.config.region && aws_default_region) {
  AWS.config.update({
    region: aws_default_region
  });
}

const allow_cidr = process.env.ALLOW_CIDR || 'x.x.x.x'
const failure_topic = process.env.FAILURE_TOPIC

module.exports.post = (event, context, callback) => {
  var found = false;
  var error = false;
  var sourceIP = event['requestContext']
    && event['requestContext']['identity']['sourceIp'] || 'local'

  allow_cidr.split(' ').forEach(function(allow_mask) {
    if(sourceIP.includes(allow_mask)) {
      found = true
    }
  });

  if (!found && sourceIP !== 'local') {
    console.error('Requestor not in allow list')

    callback(null, {
      statusCode: 403,
      headers: { 'Content-Type': 'text/plain' },
      body: '¯\\_(ツ)_/¯'+sourceIP,
    });
    return;
  }

  if(
    event.build
    && event.build.phase === 'FINALIZED'
    && event.build.status === 'FAILED'
  ) {
    var sns = new AWS.SNS();

    sns.listTopics(function(err, data) {
      let topic_found = false
      data.Topics.forEach(function(topic) {
        let topic_arn = (topic.TopicArn).split(':')
        if (failure_topic == topic_arn[topic_arn.length - 1]) {
          topic_found = true
        }
      })
      if (topic_found) {
        sns.publish({
          Message: JSON.stringify(event),
          MessageStructure: 'json',
          TopicArn: failure_topic
        }, function(err, data) {
          if (err) {
            console.log(err.stack);
            return;
          }
          const response = {
            statusCode: 200,
            headers: { 
              'Access-Control-Allow-Origin': '*',
            },
            body: {"message": "success"}
          };
          callback(null, response);
          context.done(null, 'Function Finished!');  
        })
      } else {
        callback(null, {
          statusCode: 501,
          headers: { 'Content-Type': 'text/plain' },
          body: 'There was a problem processing your request.' + error,
        });
        return;
      }
    })
  }
}
