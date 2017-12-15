jenkins-notification-service
============================

Provide an endpoint for jenkins to notify on job events


implementation
--------------

Written in NodeJS (es6), managed by Serverless and deployed on AWS Lambda.

limitations
-----------

Currently requesting lambda functions via api-gateway which is slow and more costly than hitting
directly.
