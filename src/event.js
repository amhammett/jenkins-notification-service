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
const failure_stream = process.env.FAILURE_ENDPOINT

module.exports.event = (event, context, callback) => {
  var found = false;
  var error = false;
  var sourceIP = event['requestContext']
    && event['requestContext']['identity']['sourceIp'] || 'local'

  allow_cidr.split(' ').forEach(function(allow_mask) {
    if(sourceIP.includes(allow_mask)) {
      found = true
    }
  });

  if (!found && sourceIP !== 'local' && sourceIP !== 'test-invoke-source-ip') {
    console.error('Requestor not in allow list')

    callback(null, {
      statusCode: 403,
      headers: { 'Content-Type': 'text/plain' },
      body: '¯\\_(ツ)_/¯'
    });
    return;
  }

  if (!event.build) {
    console.log(event)
    event.build = JSON.parse(event.body).body
  }

  if(
    event.build
    && event.build.phase === 'FINALIZED'
    && event.build.status === 'FAILED'
  ) {
    let params = {
      StreamName: failure_stream,
      Data: JSON.stringify(event),
      PartitionKey: 'jns-lambda-event'
    }
    var kinesis = new AWS.Kinesis();

    kinesis.putRecord(params, function(err, data) {
      if(err) {
        console.error(err.message)
        callback(null, {
          statusCode: 418,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Greatness awaits.'
        });
        return;
      }
      callback(null, {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {"message": "success"}
      });
      return;
    })
  }
  return;
}
