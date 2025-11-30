print("Starting imports...")
try:
    from PIL import Image
    print("Imported Image")
    from PIL import ImageDraw
    print("Imported ImageDraw")
    from PIL import ImageFont
    print("Imported ImageFont")
    print("All imports successful")
except Exception as e:
    print(f"Error: {e}")
