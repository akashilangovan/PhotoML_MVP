import json
import boto3
import time
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('jobstatus')
while(True):
    response = table.get_item(Key={'usernamecollection': 'AkashIlangovanWedding'})
    status = response['Item']['status']
    if(status == "Completed"):
        print("Job Done")
        print(response['Item']['output'])
        break 
    else:
        print("Lambda still running...")
    time.sleep(10)
