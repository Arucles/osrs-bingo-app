from PIL import Image
import os

# Ruta de la imagen original
img_path = "public/bingo-grid.jpg"
output_dir = "public/tiles"

os.makedirs(output_dir, exist_ok=True)
img = Image.open(img_path)
width, height = img.size

# Definir tamaño de cada casilla (Grilla 5x5)
tile_w = width / 5
tile_h = height / 5

# Píxeles a recortar en los bordes para eliminar las líneas blancas
padding = 3 

count = 1
for row in range(5):
    for col in range(5):
        left = (col * tile_w) + padding
        top = (row * tile_h) + padding
        right = ((col + 1) * tile_w) - padding
        bottom = ((row + 1) * tile_h) - padding

        cropped = img.crop((left, top, right, bottom))
        cropped.save(os.path.join(output_dir, f"{count}.jpg"))
        count += 1

print("¡Las 25 imágenes recortadas sin bordes ya están en public/tiles/!")