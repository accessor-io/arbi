import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import os
import imageio

# Input data (same as before)
KH = ["0x1", "0x3", "0x7", "0x8", "0x15", "0x31", "0x4C", "0xE0", "0x1D3", "0x202",
      "0x483", "0xA7B", "0x1460", "0x2930", "0x68f3", "0xc936", "0x1764f", "0x3080d",
      "0x57491", "0xd2c55", "0x1ba534", "0x2de40f", "0xc2a04", "0x1fa5ee5", "0x340326e",
      "0x6ac3875", "0xd916ce8", "0x172551f", "0xd94cd64", "0x7d4fe747", "0x862a62e",
      "0x1a96ca8d8", "0x966200", "0x34a03911d", "0x4aed21170", "0xde820a7c",
      "0x17577a36a", "0x22382fecd", "0x465f83ee2", "0x9e4933dd0", "0x153859acc5b",
      "0x221c58d8f", "0x3b627c591", "0x2b335a0f", "0x12fca143c05", "0x2ec18388d544",
      "0x61cb533cba", "0xade6d7ce3b9b", "0x174176b01f54d", "0x2bd43c2e9354",
      "0x75070a1a309d4", "0x8efae164cb9e3c", "0x185788e47e326c", "0x236f6d3ad1f43",
      "0x1f5bf87e67e114", "0x18b63ac4ffdf", "0x1eb25c90795d61c", "0x2b79852183a21",
      "0x7436cbb87cab44f", "0xfc07a1182367bbe", "0x13c96a3742f64906",
      "0x363d541eb611abee", "0x7cce5efdaccf6808", "0x70f1127b09112d4",
      "0x1a838b13505b26867", "0x2832ed74f2b5e35ee", "0x730fc232c1942c1ac",
      "0x6ebb3940cd6c1491", "0x101d83275f2bc7e0c", "0x349b84b6431a6c4f1"]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'outputs')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def hex_xor(a, b):
    return int(a, 16) ^ int(b, 16)

def build_difference_table():
    table = []
    current_level = list(KH)
    table.append([int(x, 16) for x in current_level])
    while len(current_level) > 1:
        next_level = []
        for i in range(len(current_level) - 1):
            diff = hex_xor(current_level[i], current_level[i + 1])
            next_level.append(hex(diff))
        if not next_level:
            break
        table.append([int(x, 16) for x in next_level])
        current_level = next_level
    return table

def compute_2d_xor_grids(table):
    max_len = len(table[0])
    horizontal_grid = np.full((len(table), max_len), np.nan)
    for i, row in enumerate(table):
        for j in range(len(row)):
            horizontal_grid[i, j] = row[j]
    vertical_grid = np.full((len(table)-1, max_len), np.nan)
    for i in range(len(table)-1):
        for j in range(min(len(table[i]), len(table[i+1]))):
            vertical_grid[i, j] = table[i][j] ^ table[i+1][j]
    return horizontal_grid, vertical_grid

def sliding_window_xor(horizontal_grid, vertical_grid, window_size=2):
    rows, cols = horizontal_grid.shape
    vrows, vcols = vertical_grid.shape
    out_rows = min(rows, vrows) - window_size + 1
    out_cols = min(cols, vcols) - window_size + 1
    output_grid = np.zeros((out_rows, out_cols))
    for i in range(out_rows):
        for j in range(out_cols):
            xor_val = 0
            for wi in range(window_size):
                for wj in range(window_size):
                    h_val = horizontal_grid[i + wi, j + wj]
                    v_val = vertical_grid[i + wi, j + wj]
                    if not np.isnan(h_val):
                        xor_val ^= int(h_val)
                    if not np.isnan(v_val):
                        xor_val ^= int(v_val)
            output_grid[i, j] = xor_val
    return output_grid

def plot_and_save(output_grid, window_size):
    plt.figure(figsize=(12, 8))
    sns.heatmap(output_grid, cmap='coolwarm', annot=False)
    plt.title(f'Full Sliding Window XOR ({window_size}x{window_size})')
    plt.xlabel('Position')
    plt.ylabel('Level')
    plt.tight_layout()
    out_img = os.path.join(OUTPUT_DIR, f'full_sliding_window_xor_{window_size}x{window_size}.png')
    plt.savefig(out_img)
    plt.close()
    out_csv = os.path.join(OUTPUT_DIR, f'full_sliding_window_xor_{window_size}x{window_size}.csv')
    np.savetxt(out_csv, output_grid, delimiter=',', fmt='%g')
    return out_img

def animate_heatmaps(image_files, out_gif):
    images = [imageio.imread(img) for img in image_files]
    imageio.mimsave(out_gif, images, duration=0.5)

if __name__ == "__main__":
    table = build_difference_table()
    horizontal_grid, vertical_grid = compute_2d_xor_grids(table)
    max_window = min(horizontal_grid.shape[0], horizontal_grid.shape[1], vertical_grid.shape[0], vertical_grid.shape[1])
    image_files = []
    for window_size in range(2, max_window+1):
        output_grid = sliding_window_xor(horizontal_grid, vertical_grid, window_size=window_size)
        img_file = plot_and_save(output_grid, window_size)
        image_files.append(img_file)
    animate_heatmaps(image_files, os.path.join(OUTPUT_DIR, 'full_sliding_window_xor_animation.gif')) 