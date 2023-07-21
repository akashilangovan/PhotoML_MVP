import boto3

sns = boto3.client('sns')

topic_arn = "arn:aws:sns:us-east-2:706389910333:CullRequest"  # replace with your Topic ARN

username = "AkashIlangovan"
collection_name = "Wedding"

message = {
    "username": username,
    "collection_name": collection_name
}

response = sns.publish(
    TopicArn=topic_arn,
    Message=str(message)
)

print(response)
