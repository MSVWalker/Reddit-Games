from PIL import Image
import sys
from collections import Counter

def clean_background(input_path, output_path):
    try:
        print(f"Processing {input_path}...")
        img = Image.open(input_path).convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        # 1. Identify Background Color by sampling edges
        edge_pixels = []
        # Top and Bottom edges
        for x in range(width):
            edge_pixels.append(pixels[x, 0])
            edge_pixels.append(pixels[x, height-1])
        # Left and Right edges
        for y in range(height):
            edge_pixels.append(pixels[0, y])
            edge_pixels.append(pixels[width-1, y])
            
        # Most common color on edges is likely the background
        bg_color = Counter(edge_pixels).most_common(1)[0][0]
        print(f"Detected background color: {bg_color}")

        # 2. Flood Fill from corners to remove background
        queue = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        visited = set(queue)
        
        # Tolerance for color matching
        def is_match(c1, c2, tolerance=40): # Increased tolerance from 20 to 40
            # Euclidean distance for better color matching
            dist = sum((c1[i] - c2[i]) ** 2 for i in range(3)) ** 0.5
            return dist <= tolerance

        while queue:
            x, y = queue.pop(0)
            
            current = pixels[x, y]
            
            # If this pixel matches the background color, make it transparent
            if is_match(current, bg_color):
                pixels[x, y] = (0, 0, 0, 0) # Full transparency
                
                # Add neighbors
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        if (nx, ny) not in visited:
                            visited.add((nx, ny))
                            queue.append((nx, ny))
                            
        # 3. Save result
        img.save(output_path, "PNG")
        print(f"Successfully saved cleaned image to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
    else:
        clean_background(sys.argv[1], sys.argv[2])
