print("Script starting...")
from PIL import Image, ImageDraw, ImageFont
import sys

def draw_airplane_ltr(draw, px, py):
    """Draw airplane facing right"""
    chive_green = (46, 204, 113, 255)
    dark_green = (39, 174, 96, 255)
    white = (255, 255, 255, 255)
    black = (44, 62, 80, 255)
    grey = (149, 165, 166, 255)
    wood = (211, 84, 0, 255)
    
    def p(x, y): return (px + x, py + y)

    # Tail Fin
    draw.polygon([p(20, 30), p(10, 10), p(40, 10), p(45, 30)], fill=white)
    draw.line([p(20, 30), p(10, 10)], fill=grey, width=2)
    
    # Rear Body
    draw.polygon([p(30, 30), p(90, 30), p(85, 50), p(40, 45)], fill=chive_green)
    
    # Top Wing
    draw.polygon([p(50, 5), p(110, 5), p(115, 15), p(45, 15)], fill=chive_green)
    draw.polygon([p(50, 5), p(110, 5), p(115, 15), p(45, 15)], outline=white, width=2)
    draw.line([p(70, 8), p(90, 12)], fill=white, width=3)
    draw.line([p(90, 8), p(70, 12)], fill=white, width=3)

    # Middle Wing
    draw.polygon([p(55, 25), p(105, 25), p(110, 35), p(50, 35)], fill=chive_green)
    draw.line([p(55, 25), p(105, 25)], fill=white, width=2)

    # Bottom Wing
    draw.polygon([p(60, 45), p(100, 45), p(105, 55), p(55, 55)], fill=chive_green)
    
    # Struts
    draw.line([p(65, 15), p(65, 45)], fill=grey, width=3)
    draw.line([p(95, 15), p(95, 45)], fill=grey, width=3)

    # Engine
    draw.pieslice([p(90, 25), p(120, 55)], 270, 90, fill=dark_green)
    
    # Cockpit & Pilot
    draw.ellipse([p(75, 20), p(95, 35)], fill=black)
    draw.ellipse([p(80, 15), p(90, 25)], fill=white)
    draw.rectangle([p(82, 22), p(92, 24)], fill=black)
    draw.polygon([p(80, 22), p(60, 20), p(65, 28)], fill=white)

    # Wheels
    draw.line([p(85, 50), p(85, 65)], fill=grey, width=3)
    draw.line([p(95, 50), p(95, 65)], fill=grey, width=3)
    draw.polygon([p(80, 60), p(100, 60), p(105, 65), p(75, 65)], fill=chive_green)
    draw.ellipse([p(80, 62), p(90, 72)], fill=black)
    draw.ellipse([p(90, 62), p(100, 72)], fill=black)

    # Propeller
    draw.ellipse([p(115, 35), p(125, 45)], fill=wood)
    draw.ellipse([p(118, 10), p(122, 70)], fill=(200, 200, 200, 150))

def draw_airplane_rtl(draw, px, py):
    """Draw airplane facing left (mirrored version)"""
    chive_green = (46, 204, 113, 255)
    dark_green = (39, 174, 96, 255)
    white = (255, 255, 255, 255)
    black = (44, 62, 80, 255)
    grey = (149, 165, 166, 255)
    wood = (211, 84, 0, 255)
    
    # Mirror all x coordinates
    def p(x, y): return (px - x, py + y)

    # Tail Fin (mirrored)
    draw.polygon([p(20, 30), p(10, 10), p(40, 10), p(45, 30)], fill=white)
    draw.line([p(20, 30), p(10, 10)], fill=grey, width=2)
    
    # Rear Body (mirrored)
    draw.polygon([p(30, 30), p(90, 30), p(85, 50), p(40, 45)], fill=chive_green)
    
    # Top Wing (mirrored)
    draw.polygon([p(50, 5), p(110, 5), p(115, 15), p(45, 15)], fill=chive_green)
    draw.polygon([p(50, 5), p(110, 5), p(115, 15), p(45, 15)], outline=white, width=2)
    draw.line([p(70, 8), p(90, 12)], fill=white, width=3)
    draw.line([p(90, 8), p(70, 12)], fill=white, width=3)

    # Middle Wing (mirrored)
    draw.polygon([p(55, 25), p(105, 25), p(110, 35), p(50, 35)], fill=chive_green)
    draw.line([p(55, 25), p(105, 25)], fill=white, width=2)

    # Bottom Wing (mirrored)
    draw.polygon([p(60, 45), p(100, 45), p(105, 55), p(55, 55)], fill=chive_green)
    
    # Struts (mirrored)
    draw.line([p(65, 15), p(65, 45)], fill=grey, width=3)
    draw.line([p(95, 15), p(95, 45)], fill=grey, width=3)

    # Engine (mirrored)
    draw.pieslice([p(120, 25), p(90, 55)], 90, 270, fill=dark_green)
    
    # Cockpit & Pilot (mirrored)
    draw.ellipse([p(95, 20), p(75, 35)], fill=black)
    draw.ellipse([p(90, 15), p(80, 25)], fill=white)
    draw.rectangle([p(92, 22), p(82, 24)], fill=black)
    draw.polygon([p(80, 22), p(60, 20), p(65, 28)], fill=white)

    # Wheels (mirrored)
    draw.line([p(85, 50), p(85, 65)], fill=grey, width=3)
    draw.line([p(95, 50), p(95, 65)], fill=grey, width=3)
    draw.polygon([p(100, 60), p(80, 60), p(75, 65), p(105, 65)], fill=chive_green)
    draw.ellipse([p(90, 62), p(80, 72)], fill=black)
    draw.ellipse([p(100, 62), p(90, 72)], fill=black)

    # Propeller (mirrored)
    draw.ellipse([p(125, 35), p(115, 45)], fill=wood)
    draw.ellipse([p(122, 10), p(118, 70)], fill=(200, 200, 200, 150))

def create_banner_plane(text, filename_base, direction='ltr'):
    """Generate airplane with banner"""
    width = 512
    height = 128
    
    print("Creating image...")
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    print(f"Generating banner for: {text}")
    try:
        # Increased font size by 25% (16 -> 20)
        # font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        font = ImageFont.load_default()
        print("Loaded default font")
    except Exception as e:
        print(f"Font error: {e}")
        font = ImageFont.load_default()
    
    print("Measuring text...")
    # Measure text to determine banner width
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    
    # Banner dimensions based on text width with padding
    banner_width = text_width + 40  # 20px padding on each side
    banner_height = 30
    
    print(f"Drawing {direction}...")
    if direction == 'ltr':
        # Airplane on RIGHT, banner extends LEFT from airplane
        plane_x = 380
        banner_end_x = plane_x - 10  # Small gap for rope
        banner_start_x = banner_end_x - banner_width
        banner_y = 20
        
        draw.polygon([
            (banner_start_x, banner_y), 
            (banner_end_x, banner_y), 
            (banner_end_x - 10, banner_y + banner_height), 
            (banner_start_x + 10, banner_y + banner_height)
        ], fill=banner_bg, outline=grey)
        
        draw.text((banner_start_x + 20, banner_y + 6), text, font=font, fill=banner_text)
        
        # Rope connecting banner to plane
        draw.line([(banner_end_x, banner_y + banner_height//2), (plane_x, 30)], fill=black, width=2)
        
        # Airplane
        draw_airplane_ltr(draw, plane_x, 0)
        
    else:  # rtl
        # Airplane on LEFT, banner extends RIGHT from airplane
        plane_x = 132
        banner_start_x = plane_x + 20  # Small gap for rope
        banner_end_x = banner_start_x + banner_width
        banner_y = 20
        
        draw.polygon([
            (banner_start_x, banner_y), 
            (banner_end_x, banner_y), 
            (banner_end_x - 10, banner_y + banner_height), 
            (banner_start_x + 10, banner_y + banner_height)
        ], fill=banner_bg, outline=grey)
        
        draw.text((banner_start_x + 20, banner_y + 6), text, font=font, fill=banner_text)
        
        # Rope connecting plane to banner
        draw.line([(plane_x, 30), (banner_start_x, banner_y + banner_height//2)], fill=black, width=2)
        
        # Airplane (mirrored)
        draw_airplane_rtl(draw, plane_x, 0)

    output_path = f'src/client/game/{filename_base}_{direction}.png'
    print(f"Saving to {output_path}...")
    img.save(output_path)
    print(f"Generated {filename_base}_{direction}.png")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        # Usage: python generate_airplane.py "Text" "filename_base"
        text = sys.argv[1]
        filename = sys.argv[2]
        create_banner_plane(text, filename, 'ltr')
        create_banner_plane(text, filename, 'rtl')
    else:
        banners = [
            ("F1exican Did Chive-11", "airplane_banner_1"),
            ("Forgive But Never Forget", "airplane_banner_2"),
            ("Chive On!", "airplane_banner_3"),
            ("Stay Sharp!", "airplane_banner_4")
        ]
        
        for text, filename in banners:
            create_banner_plane(text, filename, 'ltr')
            create_banner_plane(text, filename, 'rtl')
        
        # Base airplane.png
        create_banner_plane("F1exican Did Chive-11", "airplane", 'ltr')
        print("\nGenerated 9 total images (8 directional banners + 1 base)")
