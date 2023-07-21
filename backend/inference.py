import torch, os, shutil
from tqdm import tqdm
from torch.utils.data import DataLoader
from inference_dataset import InferenceDataset
from classifier import CullingTransformerModel
from duplicate_detection import DuplicateDetection
os.environ['TORCH_HOME'] = '/tmp' 

def inference(
        image_paths: list[str], 
        weights_path: str, 
        bucket_ratios: dict[str, float], 
        device: str = "cpu", 
        batch_size_duplicate_detect: int = 64,
        batch_size_classify: int = 16,
        min_images_per_duplicate_group: int = 3,
        verbose: bool = True
) -> dict[str, str]:
    """
    Input args:
        image_paths : a list containing the paths of images to run inference on. Images must be jpg or png
        weights_path : a string that is the path to the weights file for the transformer model
        bucket_ratios : a dictionary with keys "culled" "selected" and "maybe" mapping to fraction of images in each bucket. Eg. {"culled": 0.6, "selected": 0.15, "maybe": 0.25}
        device : device to run inference on. Can be "cpu" or "cuda"
        batch_size_duplicate_detect : batch size for feature extraction in duplicate detection model
        batch_size_classify : batch size for actial image classification in transformer model
        min_images_per_duplicate_group : minimum number of images in each duplicate group
        verbose : Verbosity of outputs (display loading progress)
    
    Returns:
        A dictionary mapping image path to the predicted image class. Values are one of "selected", "culled" or "maybe". Keys are images paths.
    """
    # Dataset setup
    dataset = InferenceDataset(image_paths)
    n_images = len(dataset)
    n_selected_images = int(bucket_ratios["selected"] * n_images)
    n_maybe_images = int(bucket_ratios["maybe"] * n_images)
    classification_inference_loader = DataLoader(dataset, batch_size=batch_size_classify, shuffle=True)


    # Model setup
    device = torch.device(device)
    duplicate_detection_model = DuplicateDetection(dev = device)
    classification_model = CullingTransformerModel(weights_path).to(device)
    classification_model.eval()


    # duplicate detection
    duplicate_groups, outliers = duplicate_detection_model.compute_duplicates(
        dataset_obj=dataset, verbose=verbose, 
        min_images_per_group=min_images_per_duplicate_group,
        batch_size=batch_size_duplicate_detect,
    )
    
    
    # classification
    if verbose: 
        print("Classifying images...")
    inference_loop = tqdm(
        classification_inference_loader, 
        total=len(classification_inference_loader), 
        position=0, leave=True
    )

    prediction_dict = {}

    n_groups = len(duplicate_groups)
    top_n = n_selected_images // n_groups
    n_in_maybe = n_maybe_images // n_groups

    for img_batch, img_paths in inference_loop:
        preds = classification_model(img_batch.to(device)).view(-1).tolist()
        for img_path, pred in zip(img_paths, preds):
            prediction_dict[img_path] = pred


    # Adjusting classification outputs based on bucket ratios
    for dg in duplicate_groups:
        scores = [prediction_dict[i] for i in dg]
        sorted_idxs = sorted(range(len(scores)), key= lambda i: scores[i])

        top_idx = min(top_n, len(dg))
        maybe_idx = min(top_n + n_in_maybe, len(dg))

        for i in range(0, top_idx):
            prediction_dict[dg[sorted_idxs[i]]] = "selected"

        for i in range(top_idx, maybe_idx):
            prediction_dict[dg[sorted_idxs[i]]] = "maybe"
        
        for i in range(maybe_idx, len(sorted_idxs)):
            prediction_dict[dg[sorted_idxs[i]]] = "culled"
        
    for outlier in outliers:
        prediction_dict[outlier] = "maybe"

    return prediction_dict


def visualize_outputs(prediction_dict: dict[str, str], output_folder_path: str) -> None:
    """
    Creates the culled, selected and maybe directories in output_folder_path and copies images from original paths
    into respective directories.
    """
    folders = ["culled", "selected", "maybe"]
    for f in folders:
        if os.path.exists(os.path.join(output_folder_path, f)):
            shutil.rmtree(os.path.join(output_folder_path, f))
        os.mkdir(os.path.join(output_folder_path, f))
    
    for fp, pred_class in prediction_dict.items():
        file_name = os.path.basename(fp)
        save_path = os.path.join(os.path.join(output_folder_path, pred_class), file_name)
        shutil.copy(fp, save_path)