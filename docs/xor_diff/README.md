# XOR Difference Visualization

## Overview
This project visualizes the propagation of XOR differences through a sequence of hexadecimal values. The visualization is a heatmap that shows how each level of XOR differences evolves, revealing patterns, structure, and the eventual collapse to zero.

## What the Script Does
- **Input:** A list of hexadecimal values (KH).
- **Process:**
  - Computes the XOR difference between each pair of adjacent values, forming a new sequence (level 1).
  - Repeats this process for each new level until only one value remains.
  - Stores all levels in a difference table.
- **Output:**
  - A heatmap where:
    - Rows = original input values
    - Columns = difference levels
    - Colors/annotations = magnitude of XOR differences
  - The visualization is saved as `xor_diff_visualization.png`.

## Mathematical & Cryptographic Background
### Difference Tables
- In mathematics, difference tables are used to analyze sequences and polynomials.
- For a sequence, the first difference is the difference between each pair of adjacent numbers; this is repeated for each new row.
- For polynomials of degree n, the nth difference is constant.

### XOR as a Difference Operator
- XOR (exclusive OR) is a bitwise operation, often used in cryptography.
- XOR is its own inverse: `a ^ b ^ b = a`.
- Using XOR in a difference table tracks how bitwise changes propagate through the sequence.

### Why the Diagonal Pattern?
- Nonzero values cluster along the diagonal because each new level "consumes" one value from the sequence.
- The triangle collapses to zero because repeated XOR differences eventually cancel out all information (unless the sequence is random).

### Cryptographic Relevance
- Difference tables are used to analyze diffusion and avalanche properties in hash functions and ciphers.
- Patterns or anomalies can indicate structure or weaknesses in cryptographic data.

## How to Interpret the Visualization
- **Diagonal Structure:** Shows how differences propagate and collapse.
- **Color Intensity:** Highlights where the largest differences occur.
- **Zero Collapse:** The process eventually reduces all values to zero, showing information loss through repeated XOR.
- **Pattern Detection:** Regularities, repetitions, or outliers become visible.

## How to Run the Script
1. Ensure you have Python 3 and the required packages:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the script:
   ```bash
   python src/visualization/xor_diff_visualizer.py
   ```
3. The output image will be saved as `xor_diff_visualization.png` in your workspace.

## How to Extend the Script
- **Change Input Data:** Edit the `KH` list in `xor_diff_visualizer.py`.
- **Try Other Operations:** Replace XOR with subtraction or another operation for different effects.
- **Adjust Visualization:** Change color maps, remove annotations, or use log scale for better contrast.
- **Analyze Other Data:** Use this method to analyze cryptographic keys, hashes, or any sequence of numbers.

## References
- [Difference Table (Wikipedia)](https://en.wikipedia.org/wiki/Finite_difference)
- [XOR Operation (Wikipedia)](https://en.wikipedia.org/wiki/Exclusive_or)
- [Cryptographic Avalanche Effect](https://en.wikipedia.org/wiki/Avalanche_effect)

## 2D XOR Difference Grids: Horizontal and Vertical

### What Are 2D XOR Differences?
- **Horizontal XORs:** The standard difference table, where each value is XORed with its immediate neighbor to the right.
- **Vertical XORs:** XORing each value with the value directly below it in the difference table (if it exists).
- **2D Grid:** By calculating both, you create a 2D grid of differences, similar to how gradients are computed in image processing.

### How to Compute
- For each cell in the difference table:
  - **Horizontal XOR:** `H[i][j] = Table[i][j] ^ Table[i][j+1]` (if `j+1` exists)
  - **Vertical XOR:** `V[i][j] = Table[i][j] ^ Table[i+1][j]` (if `i+1` exists)

### Why Is This Useful?
- **Pattern Detection:** Reveals more complex structures and relationships in the data.
- **Cryptography:** Helps analyze how information diffuses across both sequence and transformation layers.
- **Data Analysis:** Analogous to edge detection in images, highlighting where changes are most significant.

### Visualization
- You can visualize the 2D XOR grid as a heatmap, with color intensity representing the magnitude of the XOR in each direction.
- This provides a richer, more detailed view of how differences propagate through the data.

---

*This documentation was auto-generated to help you understand and extend the XOR difference visualization project.* 