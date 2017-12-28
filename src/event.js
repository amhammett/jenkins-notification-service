'use strict';

const https = require('https');
const AWS = require('aws-sdk');

const aws_default_region = process.env.AWS_DEFAULT_REGION
if (!AWS.config.region && aws_default_region) {
  AWS.config.update({
    region: aws_default_region
  });
}

const env_name = process.env.ENV || 'missing'
const allow_cidr = process.env.ALLOW_CIDR || 'x.x.x.x'
const failure_stream = process.env.FAILURE_ENDPOINT || 'jfs-'+env_name+'failures'

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

  let jenkins_data = JSON.parse(event.body)
  console.log('event triggered for ' +jenkins_data.name+ ' with status ' +jenkins_data.build.status)

  if(
    jenkins_data.build
    && jenkins_data.build.phase === 'FINALIZED'
    && jenkins_data.build.status === 'FAILURE'
  ) {
    console.log('failure detected')

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

      console.log('successfully put kinesis record: ')
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
