import os
from inference import inference, visualize_outputs
import boto3
from botocore.exceptions import NoCredentialsError
import json
def download_files_from_s3(bucket_name, s3_folder, local_folder):
    s3 = boto3.resource('s3')
    
    bucket = s3.Bucket(bucket_name)
    print("trying download")
    print(bucket, bucket_name, s3_folder, local_folder)
    for obj in bucket.objects.filter(Prefix=s3_folder):

        target = os.path.join(local_folder, os.path.relpath(obj.key, s3_folder))
        # making directory if it does not exist
        if not os.path.exists(os.path.dirname(target)): 
            os.makedirs(os.path.dirname(target))

        bucket.download_file(obj.key, target)

def lambda_handler(event, context):
    print(event)
   
    message = event['Records'][0]['Sns']['Message']
        
    # Convert the string representation of the dictionary to an actual dictionary
    message_dict = json.loads(message.replace("'", "\""))
        
    username = message_dict['username']
    collection_name = message_dict['collection_name']# collection = event['collection']

    message = "Success"
    bucket_name = "testing-new-akash"  # replace with your bucket name
    s3_folder = "uploads/"+username+"/" + collection_name  # replace with your s3 folder name
    s3_weight =  "uploads/testuser/classifier.pth"
    local_folder = "/tmp/"  # replace with your local folder path

    try:
        print("Downloading files from S3 kkmkm bucket...")
        download_files_from_s3(bucket_name, s3_folder, local_folder)
        print("Downloaded all files from S3 bucket.")
    except NoCredentialsError:
        print("No AWS credentials found.")
        message = "Error"
        return { 
            'message' : message
        }
    
   
    weights = "/tmp/weightsfile.pth"
    print("Downloading weights from S3 bucket...")
    download_file_from_s3(bucket_name, s3_weight, weights)
    predictions = runInference(local_folder, weights)
    print(predictions)
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('jobstatus')
        response = table.put_item(
            Item={
                'usernamecollection': username + collection_name,
                'status': 'Completed', 
                'output': str(predictions)
            }
        )
        print(f"PutItem succeeded: {json.dumps(response, indent=4)}")
    except Exception as e:
            print(f"Failed to put item: {e.response['Error']['Message']}")
    return { 
            'statusCode': 200,
            'status': 'success',
            'message' : str(predictions)
        }

def download_file_from_s3(bucket_name, s3_key, local_path):
    s3 = boto3.client('s3')
   
    try:
        with open(local_path, 'wb') as f:
            s3.download_fileobj(bucket_name, s3_key, f)

        print(f"Downloaded weights successfully. Weights saved at {local_path}")
    except Exception as e:
        print(f"Error occurred: {e}")

def runInference(local_path, weight_path):
    folder_path = local_path
    image_names = os.listdir(folder_path)
    image_paths = [os.path.join(folder_path, i) for i in image_names if (i.endswith("jpg") or i.endswith("png") or i.endswith("jpeg"))]
    print(f"Found {len(image_paths)} images in {folder_path}")
    print("Running inference on images...")
    predictions = inference(
        image_paths=image_paths,
        weights_path=weight_path,
        bucket_ratios = {"culled": 0.65, "selected": 0.05, "maybe": 0.3},
        device = "cpu"
    )
    print(f"Culled : {sum([i == 'culled' for i in predictions.values()])}")
    print(f"Selected : {sum([i == 'selected' for i in predictions.values()])}")
    print(f"Maybe : {sum([i == 'maybe' for i in predictions.values()])}")
    culled = [ (i.split("/")[2]).replace(".jpg", ".nef") for i in predictions.keys() if predictions[i] == "culled"]
    selected = [ (i.split("/")[2]).replace(".jpg", ".nef") for i in predictions.keys() if predictions[i] == "selected"]
    maybe = [(i.split("/")[2]).replace(".jpg", ".nef")  for i in predictions.keys() if predictions[i] == "maybe"]
    return[
        culled,
        selected,
        maybe
    ]
    # visualize_outputs(predictions, "/Users/akashilangovan/photoml/PhotoML-transformer/output")