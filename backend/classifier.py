import torch
from torch import nn
from torchvision.models import vit_b_16, ViT_B_16_Weights
import os
os.environ['TORCH_HOME'] = '/tmp' 
class ModelClassifier(nn.Module):

    def __init__(self):
        super(ModelClassifier, self).__init__()
        self.classifier = nn.Sequential(
            nn.Linear(768, 256),
            nn.ReLU(),
            nn.Dropout(p=0.5),
            nn.Linear(256, 1)
        )
    
    def forward(self, x):
        return self.classifier(x)


class CullingTransformerModel(nn.Module):

    def __init__(self, classifier_weight_path: str):
        super(CullingTransformerModel, self).__init__()
        self.encoder = vit_b_16(weights = ViT_B_16_Weights.IMAGENET1K_V1)
        self.encoder.heads.head = nn.Identity()
        for param in self.encoder.parameters():
            param.requires_grad = False

        self.classifier = ModelClassifier()
        self.classifier.load_state_dict(torch.load(classifier_weight_path, map_location="cpu"))
        for param in self.classifier.parameters():
            param.requires_grad = False

        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.encoder(x)
        return self.sigmoid(self.classifier(x))
