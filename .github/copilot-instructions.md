# Copilot Instructions: Jupyter Data Science Codespace

## Project Overview
This is an educational data science environment using **Jupyter notebooks** with Python, PyTorch, pandas, and matplotlib. The project contains three example notebooks demonstrating key data science and ML workflows. Notebooks are **self-contained, exploratory tutorials**—each teaches a specific concept or workflow independently.

## Key Architecture

**File Structure:**
- `notebooks/` - Jupyter notebooks; each is a self-contained tutorial
  - `image-classifier.ipynb` - PyTorch CNN training on CIFAR-10 (step-by-step image classification tutorial)
  - `matplotlib.ipynb` - Data visualization patterns and pyplot API examples
  - `population.ipynb` - CSV data loading and simple plotting from tabular data
- `data/` - Data files (CSVs, downloaded datasets like CIFAR-10 during runtime)
- `requirements.txt` - Python dependencies (torch, pandas, matplotlib, etc.)

## Notebook Patterns

### Image Preprocessing (CIFAR-10 Pattern)
Standardized normalization for image classification:
```python
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
])
```
- Images normalized to range [-1, 1] (mean=0.5, std=0.5 per channel)
- Always **denormalize before plotting**: `img / 2 + 0.5`
- **Tensor format is channel-first (C, H, W)**; convert to (H, W, C) for matplotlib: `np.transpose(npimg, (1, 2, 0))`
- Use `torch.utils.data.DataLoader` with `batch_size`, `shuffle=True` for training, `shuffle=False` for evaluation
- Download datasets with `torchvision.datasets.CIFAR10(root='./data', download=True)` → stored in `./data/` at runtime

### PyTorch Model Training Pattern
- Define custom `nn.Module` architectures as classes with `__init__()` (layer definitions) and `forward()` (computation graph)
- Loss & optimizer: `nn.CrossEntropyLoss()` with `optim.SGD(lr=0.001, momentum=0.9)` for classification
- Training loop: iterate over `DataLoader`, call `optimizer.zero_grad()`, compute loss, `loss.backward()`, `optimizer.step()`
- **Always wrap training loops with `tqdm`**: `for i, data in enumerate(tqdm(trainloader, ...))` for progress visibility
- Save trained model: `torch.save(net.state_dict(), PATH)` → produces `.pth` checkpoint file

### Model Evaluation Pattern
- Load trained weights: `net.load_state_dict(torch.load(PATH))`
- Use `torch.no_grad()` context to disable gradient tracking during inference (faster, lower memory)
- Get predictions: `_, predicted = torch.max(outputs, 1)` → argmax over class dimension
- Per-class accuracy: iterate test set, accumulate correct predictions per class, compute accuracy as `100 * correct / total`
- Visualize predictions with color coding: **green for correct, red for incorrect** (see image-classifier cell 9)

### Data Visualization (Matplotlib Pattern)
- **Line plots**: `plt.plot(x, y)` with optional format strings (`'r--'` = red dashed, `'bs'` = blue square, `'g^'` = green triangle)
- **Scatter plots**: `plt.scatter(x, y)` with `c=colors` and `s=sizes` for multi-dimensional visualization
- **Bar plots**: `plt.bar(categories, values)` for categorical data
- **Multi-plot grids**: `plt.subplot(rows, cols, index)` to create N subplots; adjust with `figsize=(width, height)`
- **Axis control**: `plt.axis([xmin, xmax, ymin, ymax])` to set viewport; `plt.axis('off')` to hide axes (useful for image grids)
- **Labels & titles**: `plt.xlabel()`, `plt.ylabel()`, `plt.title()`, `plt.suptitle()` structure plots
- **Data-driven plotting**: can pass pandas DataFrames with `data=df` and reference columns by name in x, y arguments

### Tabular Data (CSV Pattern)
- Load with `pandas.read_csv('../data/filename.csv')` → returns DataFrame
- Access columns: `df['column_name']` returns Series for plotting
- Relative paths from notebook location (e.g., `../data/` for CSV in root data folder)

## Dependencies & Environment
- **PyTorch ecosystem**: torch, torchvision (datasets, transforms), tqdm (progress bars)
- **Data handling**: pandas (CSV I/O), numpy (array operations)
- **Visualization**: matplotlib, pillow (image handling)
- **Workspace setup**: Python 3.x virtual environment in dev container (Ubuntu 20.04)
- Run notebook cells in order; earlier cells define shared functions, classes, and data iterators

## Running & Iteration
- Notebooks are **exploratory** — individual cells can be re-run; kernel state is preserved across cell executions
- Cell outputs (plots, images, tensors) display inline; re-run cells to update visualizations after parameter changes
- `.pth` files are PyTorch model checkpoints; persistent across notebook restarts
- Data files (CSVs, CIFAR-10 downloads) are downloaded to `data/` folder on first run; subsequent runs reuse cached data
- **Preserve structure**: markdown headings (e.g., "Step 1: Download dataset") organize tutorials—maintain them when editing
- Common edit workflow: modify hyperparameters (lr, epochs, batch_size) and re-run training cell to compare results
