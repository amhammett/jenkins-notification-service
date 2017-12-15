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
const jes_endpoint = process.env.JES_ENDPOINT || 'https://127.0.0.1:3001'
const jes_function = process.env.JES_FUNCTION || 'jes-missing-v1-list'

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

  if(event.build.phase === 'FINALIZED' && event.build.status === 'FAILED') {
    var lambda = new AWS.Lambda();

    lambda.invoke({
      FunctionName: jes_function,
      Payload: ''
    }, function(error, data) {
      if (error) {
        console.error(error)
        callback(null, {
          statusCode: 501,
          headers: { 'Content-Type': 'text/plain' },
          body: 'There was a problem processing your request.' + error,
        });
        return;
      }
      if(data.Payload) {
        var sender_domain = event.build.full_url.split('/')[2].split(':')[0]
        if (sender_domain === 'localhost' || sender_domain.includes('192.168')) {
          sender_domain = "sm-jenkins-local.scea.com"
        }

        var sender_name = sender_domain.split('.')[0].replace(/-/g, ' ')
        var replace_dict = {
          'ci': 'CI',
          'master': 'Master',
          'jenkins': 'Jenkins',
          'sm': 'Santa Monica',
          'localhost': 'Local',
          'local': 'Local'
        }
        Object.keys(replace_dict).forEach(function(key) {
          sender_name = sender_name.replace(key, replace_dict[key])
        });

        // to be moved to separate lambda
        console.log(sender_name+" <no-reply@"+sender_domain+">")
        console.log("Failure detected in "+event.name+" #"+event.build.number)
        console.log("investigate at: "+event.build.full_url)

        var email_list = [];
        var records = JSON.parse(JSON.parse(data.Payload).body)
        records.forEach(function(record) {
          if((event.url).search(record.pattern) !== -1) {
            email_list.push(record.email)
          }
        });
        console.log(email_list)
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: {"message": "success"}
        };
        callback(null, response);
        return;
      }
    });
  }
}
