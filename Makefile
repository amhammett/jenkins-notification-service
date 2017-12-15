
function_name = jns

env := missing
profile := sms-dev
region := us-east-1
stage := v1
allow_cidr := x.x.x.x

AWS_PARAMS=AWS_PROFILE=$(profile) AWS_DEFAULT_REGION=${region}

local-invoke:
	${AWS_PARAMS} JES_ENDPOINT="${jes_endpoint}" JES_FUNCTION="${jes_function}" ./node_modules/.bin/lambda-local -t 20 -f $(function_file) -e $(event_file)

deploy:
	${AWS_PARAMS} JES_ENDPOINT="${jes_endpoint}" ALLOW_CIDR="$(allow_cidr)" ENV=${env} ./node_modules/.bin/serverless deploy --stage ${stage}

invoke:
	${AWS_PARAMS} ENV=${env} ./node_modules/.bin/serverless invoke --stage ${stage} -f $(function_name)

remove:
	${AWS_PARAMS} ENV=${env} ./node_modules/.bin/serverless remove --stage ${stage}
