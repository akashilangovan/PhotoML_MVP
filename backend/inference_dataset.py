from PIL import Image
from torchvision import transforms
from torch.utils.data import Dataset
import os
os.environ['TORCH_HOME'] = '/tmp' 
class InferenceDataset(Dataset):
    
    def __init__(self, image_paths_list: list[str]):
        self.image_paths = image_paths_list
        self.T = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor()
        ])

    def __len__(self):
        return len(self.image_paths)
    
    def __getitem__(self, idx: int):
        return self.T(Image.open(self.image_paths[idx])), self.image_paths[idx]