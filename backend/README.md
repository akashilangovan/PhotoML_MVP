# PhotoML MVP - Transformer model architecture

This repository contains the code and model weights for the transformer model architecture for the PhotoML MVP.

The `demo.ipynb` file demonstrates how the modules are to be used.

## Environment initialization
1. Install conda
2. Create a new conda environment with the following command, replacing `<env-name>` with the name of the environment.
```conda create -n <env-name> python==3.11```
3. Activate the environment
```conda activate <env-name>```
4. Install required packages with
```pip install -r requirements.txt```
5. Test that environment is setup by running `demo.ipynb`. Replace files paths with paths on your local system to point to image datasets.