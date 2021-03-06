Satellite Image Classification
---
The classification dataset is obtained from Northwestern Polytechnical University (NWPU) that originally contains 45 classes of images. This project is an exploration to the right CNN model that is simple yet effective in classifying these images. The following image is the original classes in the dataset.

![Original Classes in the Dataset](http://www.escience.cn/system/img?imgId=86962)

To simplify the problem, the dataset is downsampled into 12-classes of 700 images each.

![Downsampled Dataset](12-classes.png)

There are two proposed model to this 12-classes dataset: model A, and model B that is slightly more complex than model A.

The configuration of the models is as follows:

1. Model A:
  -  **128 batch size**
  -  **96x96x3 Input Layer**
  -  3x3x16 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x32 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  Flatten Layer
  -  128 Unit Hidden Layer
  -  12 Unit Output Layer

2. Model B:
  -  **256 batch size**
  -  **128x128x3 Input Layer**
  -  5x5x16 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x32 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  3x3x64 Convolutional Layer
  -  2x2 Max Pooling Layer
  -  Flatten Layer
  -  128 Unit Hidden Layer
  -  **128 Unit Hidden Layer**
  -  12 Unit Output Layer

_Note: The bolded texts are the layer which differentiate the two models_

During training, Model A reached its peak of accuracy at 83% after 128 epochs while Model B had 81% after 96 epochs of training. The training of the model is stopped at their respective epoch of peak accuracy.

Model A proved that a simple model is enough to classify the dataset with higher classification accuracy than Model B. The similar performance can be seen when the model configurations are modified to 45 classes dataset, but the accuracy for Model A dropped to 64.26% as Model B to 63.69%.

A quick analysis showed that some of the mislabelled images are quite similar to their predicted class. Below is an example of the mis-classified image of residential area as commercial area:

![Misclassified Image](12-misclassified.png)

When we looked into the images of these two classes, most of the features from two classes are similar (e.g. square buildings, shades ranging from white to dark gray)

For 45-classes classification, there are 15 classes with F1-measure of less than 60% for model A and 17 classes for model B. This means model B has poor recognition in more classes than model A.

Overall, the complexity of model B is not necessary to produce a high accuracy classification.


[1]: http://www.escience.cn/people/JunweiHan/NWPU-RESISC45.html
[2]: https://github.com/ye-yu/cnn-classification
