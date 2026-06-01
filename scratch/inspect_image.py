from PIL import Image

img_path = "native/assets/images/splash-icon.png"
try:
    img = Image.open(img_path)
    print("Dimensions:", img.size)
    print("Format:", img.format)
    print("Mode:", img.mode)
    
    # Get colors
    colors = img.getcolors(maxcolors=10000)
    if colors:
        print("Number of unique colors:", len(colors))
        # Print top 5 colors by count
        sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)
        print("Top colors (count, color):")
        for count, color in sorted_colors[:10]:
            print(f" - {count}: {color}")
    else:
        print("Too many colors to list.")
except Exception as e:
    print("Error:", e)
