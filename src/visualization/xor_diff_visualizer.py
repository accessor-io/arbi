import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

# Input data
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

def hex_xor(a, b):
    return hex(int(a, 16) ^ int(b, 16))

def calculate_differences():
    all_differences = {}
    all_differences[0] = list(KH)
    current_level = list(KH)
    level = 1
    
    while len(current_level) > 1:
        next_level = []
        for i in range(len(current_level) - 1):
            diff = hex_xor(current_level[i], current_level[i + 1])
            next_level.append(diff)
        if not next_level:
            break
        all_differences[level] = next_level
        current_level = next_level
        level += 1
    
    return all_differences

def create_visualization():
    # Calculate differences
    all_differences = calculate_differences()
    
    # Create a matrix for the heatmap
    max_level = max(all_differences.keys())
    matrix = np.zeros((len(KH), max_level + 1))
    
    # Fill the matrix with XOR values
    for level, diffs in all_differences.items():
        for i, diff in enumerate(diffs):
            if i < len(KH):
                matrix[i, level] = int(diff, 16)
    
    # Create the visualization
    plt.figure(figsize=(15, 10))
    sns.heatmap(matrix, cmap='viridis', annot=True, fmt='.0f', 
                xticklabels=[f'Level {i}' for i in range(max_level + 1)],
                yticklabels=[f'Input {i+1}' for i in range(len(KH))])
    
    plt.title('XOR Difference Pattern Visualization')
    plt.xlabel('Difference Level')
    plt.ylabel('Input Index')
    plt.tight_layout()
    
    # Save the visualization
    plt.savefig('xor_diff_visualization.png')
    plt.close()

if __name__ == "__main__":
    create_visualization() 