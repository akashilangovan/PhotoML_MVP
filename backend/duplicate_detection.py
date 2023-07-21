import torch
import numpy as np
from tqdm import tqdm
from PIL import Image
from torchvision import models
import os 
os.environ['MPLCONFIGDIR'] = os.getcwd() + "/configs/"
os.environ['TORCH_HOME'] = '/tmp' 
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from torch.utils.data import Dataset, DataLoader


class DuplicateDetection:

    def __init__(self, dev: torch.device):
        self.dev = dev
        self.mobilenetv3 = models.mobilenet_v3_large(weights = models.MobileNet_V3_Large_Weights.IMAGENET1K_V2).features[:14]
        self.mobilenetv3 = self.mobilenetv3.to(self.dev)
        for p in self.mobilenetv3.parameters():
            p.requires_grad = False
        self.mobilenetv3.eval()

    def compute_features(self, dataset_obj: Dataset, batch_size: int, verbose: bool) -> torch.Tensor:
        loop = DataLoader(dataset_obj, batch_size = batch_size, shuffle = False)
        if verbose:
            print("Computing features from MobileNetV3...")
            loop = tqdm(loop, total = len(loop), position = 0, leave = True)

        features = []
        for img_batch, img_paths in loop:
            features.append(self.mobilenetv3(img_batch.to(self.dev)).flatten(start_dim=1))
        return torch.concat(features, dim = 0)

    def compress_features(self, features: torch.Tensor) -> torch.Tensor:
        self.PCA = PCA(n_components = min(features.shape) // 4)
        return torch.from_numpy(self.PCA.fit_transform(features))

    def compute_correlation_matrix(self, condensed_features: torch.Tensor) -> torch.Tensor:
        normed = condensed_features.norm(dim = 1).unsqueeze(1)
        norm_matrix = normed.matmul(normed.T)
        cosine_matrix = condensed_features.matmul(condensed_features.T) / norm_matrix
        cosine_matrix.clamp_(-1, 1)
        return torch.acos(cosine_matrix)

    def cluster_features(self, features: torch.Tensor, min_samples: int, cluster_threshold: float = 0.5) -> list[list[int]]:
        labels = DBSCAN(eps = cluster_threshold, min_samples=min_samples, metric="cosine").fit(features).labels_
        unique_labels = np.unique(labels)
        unique_labels = unique_labels[unique_labels != -1]
        clusters = []
        for label in unique_labels:
            idxs_in_cluster = list((labels == label).nonzero()[0])
            clusters.append([self.dataset_obj[i][1] for i in idxs_in_cluster])

        outlier_idxs = list((labels == -1).nonzero()[0])
        outliers = [self.dataset_obj[i][1] for i in outlier_idxs]
        return clusters, outliers
        
    def compute_duplicates(self, dataset_obj: Dataset, min_images_per_group: int, batch_size: int = 64, verbose: bool = False):
        self.dataset_obj = dataset_obj
        features = self.compute_features(
            dataset_obj=self.dataset_obj,
            batch_size=batch_size,
            verbose=verbose,
        )
        reduced_dim_features = self.compress_features(features)
        return self.cluster_features(reduced_dim_features, min_samples=min_images_per_group)
    
    def visualize_duplicate_groups(self, groups: list[list[int]], idx_to_fp: dict[int, str]):
        for i, group in enumerate(groups):
            fig, axis = plt.subplots(nrows = 3, ncols = 3, figsize = (20, 10))
            axis = axis.flatten()
            fig.suptitle(f"Duplicate group {i + 1}")
            for idx, ax in zip(group, axis):
                ax.imshow(Image.open(idx_to_fp[idx]))
                ax.axis(False)
            plt.show()